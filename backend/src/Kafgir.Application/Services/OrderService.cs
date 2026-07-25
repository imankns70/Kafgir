using System.Globalization;
using Kafgir.Application.Interfaces;
using Kafgir.Contracts.Orders;
using Kafgir.Domain.Entities;
using DomainDeliveryMethod = Kafgir.Domain.Enums.DeliveryMethod;
using DomainOrderStatus = Kafgir.Domain.Enums.OrderStatus;
using DomainPaymentMethod = Kafgir.Domain.Enums.PaymentMethod;

namespace Kafgir.Application.Services;

public sealed class OrderService(
    IOrderRepository orderRepository,
    IDailyMenuRepository dailyMenuRepository,
    ICustomerIdentityService customerIdentityService,
    ITelegramInitDataValidator telegramInitDataValidator,
    INotificationQueue notificationQueue,
    IUnitOfWork unitOfWork) : IOrderService
{
    private const string DefaultCity = "اندیمشک";

    public async Task<OrderDto> CreateAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken = default) =>
        await CreateCoreAsync(request, allowMissingTelegramIdentity: false, cancellationToken);

    public async Task<OrderDto> CreateAdminAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken = default) =>
        await CreateCoreAsync(request, allowMissingTelegramIdentity: true, cancellationToken);

    private async Task<OrderDto> CreateCoreAsync(
        CreateOrderRequest request,
        bool allowMissingTelegramIdentity,
        CancellationToken cancellationToken)
    {
        ValidateCreateRequest(request);
        var now = DateTime.UtcNow;
        var orderNumber = await GenerateOrderNumberAsync(now, cancellationToken);
        var fullName = request.FullName.Trim();
        var phoneNumber = NormalizePhoneNumber(request.PhoneNumber);
        var telegramIdentity = ResolveTelegramIdentity(request, allowMissingTelegramIdentity);
        var profile = await customerIdentityService.ResolveAsync(
            telegramIdentity.UserId,
            telegramIdentity.Username,
            telegramIdentity.FirstName,
            telegramIdentity.LastName,
            fullName,
            phoneNumber,
            now,
            cancellationToken);

        var address = ResolveAddress(profile, request, now);
        var deliveryCity = address?.City ?? NormalizeOptional(request.City) ?? DefaultCity;
        var deliveryAddressLine = address?.AddressLine ?? NormalizeOptional(request.AddressLine) ?? string.Empty;
        var deliveryDescription = address?.Description ?? NormalizeOptional(request.AddressDescription);

        var order = new Order
        {
            OrderNumber = orderNumber,
            CustomerProfile = profile,
            CustomerProfileId = profile.Id,
            CustomerAddress = address,
            CustomerAddressId = address?.Id,
            DeliveryFullName = fullName,
            DeliveryPhoneNumber = phoneNumber,
            DeliveryCity = deliveryCity,
            DeliveryAddressLine = deliveryAddressLine,
            DeliveryAddressDescription = deliveryDescription,
            Status = DomainOrderStatus.PendingConfirmation,
            PaymentMethod = (DomainPaymentMethod)request.PaymentMethod,
            DeliveryMethod = (DomainDeliveryMethod)request.DeliveryMethod,
            DeliveryFee = 0,
            CustomerNote = NormalizeOptional(request.CustomerNote),
            CreatedAt = now
        };

        foreach (var requestedItem in request.Items)
        {
            var menuItem = await dailyMenuRepository.GetItemByIdAsync(
                requestedItem.DailyMenuItemId,
                cancellationToken)
                ?? throw new ArgumentException(
                    $"Daily menu item with id {requestedItem.DailyMenuItemId} was not found.");

            if (!menuItem.IsAvailable)
            {
                throw new ArgumentException($"{menuItem.Food.Name} is not available.");
            }

            if (!menuItem.DailyMenu.IsOpen)
            {
                throw new ArgumentException(
                    $"The daily menu for {menuItem.DailyMenu.MenuDate:yyyy-MM-dd} is closed.");
            }

            order.Items.Add(new OrderItem
            {
                Order = order,
                DailyMenuItemId = menuItem.Id,
                DailyMenuItem = menuItem,
                FoodName = menuItem.Food.Name,
                UnitPrice = menuItem.Price,
                Quantity = requestedItem.Quantity,
                TotalPrice = menuItem.Price * requestedItem.Quantity
            });
        }

        order.SubtotalAmount = order.Items.Sum(item => item.TotalPrice);
        order.TotalAmount = order.SubtotalAmount + order.DeliveryFee;
        await orderRepository.AddAsync(order, cancellationToken);
        await notificationQueue.EnqueueAdminOrderSubmittedAsync(order, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(order);
    }

    public async Task<IReadOnlyList<OrderSummaryDto>> GetByDateAsync(
        DateOnly date,
        OrderStatus? status = null,
        CancellationToken cancellationToken = default)
    {
        if (date == default)
        {
            throw new ArgumentException("Date is required.");
        }

        if (status.HasValue && !Enum.IsDefined(status.Value))
        {
            throw new ArgumentException("Order status is invalid.");
        }

        var orders = await orderRepository.GetByDateAsync(
            date,
            status.HasValue ? (DomainOrderStatus)status.Value : null,
            cancellationToken);
        return orders.Select(MapSummary).ToList();
    }

    public async Task<IReadOnlyList<OrderSummaryDto>> SearchAsync(
        OrderReportQuery query,
        CancellationToken cancellationToken = default)
    {
        if (query.Date == default)
        {
            throw new ArgumentException("Date is required.");
        }

        if (query.Status.HasValue && !Enum.IsDefined(query.Status.Value))
        {
            throw new ArgumentException("Order status is invalid.");
        }

        if (query.DeliveryMethod.HasValue && !Enum.IsDefined(query.DeliveryMethod.Value))
        {
            throw new ArgumentException("Delivery method is invalid.");
        }

        if (query.PaymentMethod.HasValue && !Enum.IsDefined(query.PaymentMethod.Value))
        {
            throw new ArgumentException("Payment method is invalid.");
        }

        var orders = await orderRepository.SearchAsync(query, cancellationToken);
        return orders.Select(MapSummary).ToList();
    }

    public async Task<OrderDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var order = await orderRepository.GetByIdAsync(id, cancellationToken);
        return order is null ? null : Map(order);
    }

    public async Task<bool> UpdateStatusAsync(
        int id,
        UpdateOrderStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!Enum.IsDefined(request.NewStatus))
        {
            throw new ArgumentException("Order status is invalid.");
        }

        var order = await orderRepository.GetByIdWithDetailsAsync(id, cancellationToken);
        if (order is null)
        {
            return false;
        }

        var newStatus = (DomainOrderStatus)request.NewStatus;
        if (!IsAllowedTransition(order.Status, newStatus))
        {
            throw new ArgumentException($"Order status cannot change from {order.Status} to {newStatus}.");
        }

        var previousStatus = order.Status;
        var now = DateTime.UtcNow;
        if (newStatus == DomainOrderStatus.Confirmed)
        {
            Confirm(order, now);
        }
        else if (newStatus == DomainOrderStatus.Cancelled)
        {
            Cancel(order, now);
        }
        else if (newStatus == DomainOrderStatus.Delivered)
        {
            order.DeliveredAt = now;
        }

        order.Status = newStatus;
        if (request.AdminNote is not null)
        {
            order.AdminNote = NormalizeOptional(request.AdminNote);
        }

        order.StatusHistories.Add(new OrderStatusHistory
        {
            Order = order,
            FromStatus = previousStatus,
            ToStatus = newStatus,
            Note = NormalizeOptional(request.StatusNote),
            ChangedAt = now
        });

        await notificationQueue.EnqueueCustomerOrderStatusChangedAsync(order, newStatus, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static CustomerAddress? ResolveAddress(
        CustomerProfile profile,
        CreateOrderRequest request,
        DateTime now)
    {
        if (request.CustomerAddressId.HasValue)
        {
            var savedAddress = profile.Addresses.SingleOrDefault(address =>
                address.Id == request.CustomerAddressId.Value && address.IsActive)
                ?? throw new ArgumentException("The selected saved address was not found.");
            savedAddress.LastUsedAt = now;
            return savedAddress;
        }

        if (string.IsNullOrWhiteSpace(request.AddressLine))
        {
            return null;
        }

        if (!request.SaveAddress)
        {
            return null;
        }

        var address = new CustomerAddress
        {
            CustomerProfile = profile,
            Title = NormalizeOptional(request.NewAddressTitle) ?? "آدرس جدید",
            City = NormalizeOptional(request.City) ?? DefaultCity,
            AddressLine = request.AddressLine.Trim(),
            Description = NormalizeOptional(request.AddressDescription),
            IsDefault = !profile.Addresses.Any(existing => existing.IsActive && existing.IsDefault),
            IsActive = true,
            CreatedAt = now,
            LastUsedAt = now
        };
        profile.Addresses.Add(address);
        return address;
    }

    private TelegramIdentity ResolveTelegramIdentity(
        CreateOrderRequest request,
        bool allowMissingTelegramIdentity)
    {
        if (allowMissingTelegramIdentity && string.IsNullOrWhiteSpace(request.TelegramInitData))
        {
            return new TelegramIdentity(null, null, null, null);
        }

        var validation = telegramInitDataValidator.Validate(request.TelegramInitData);
        if (validation.IsValid)
        {
            return new TelegramIdentity(
                validation.UserId,
                validation.Username,
                validation.FirstName,
                validation.LastName);
        }

        if (validation.CanUseDevelopmentFallback)
        {
            return new TelegramIdentity(request.TelegramUserId, request.TelegramUsername, null, null);
        }

        throw new UnauthorizedAccessException(validation.Error ?? "Telegram initData is invalid.");
    }

    private static void Confirm(Order order, DateTime now)
    {
        foreach (var item in order.Items)
        {
            if (item.DailyMenuItem.RemainingPortions < item.Quantity)
            {
                throw new ArgumentException(
                    $"Not enough remaining portions for {item.FoodName}. Requested: {item.Quantity}, remaining: {item.DailyMenuItem.RemainingPortions}.");
            }
        }

        foreach (var item in order.Items)
        {
            item.DailyMenuItem.SoldPortions += item.Quantity;
        }

        order.ConfirmedAt = now;
    }

    private static void Cancel(Order order, DateTime now)
    {
        if (order.Status is DomainOrderStatus.Confirmed or DomainOrderStatus.Preparing or DomainOrderStatus.Ready)
        {
            foreach (var item in order.Items)
            {
                item.DailyMenuItem.SoldPortions = Math.Max(0, item.DailyMenuItem.SoldPortions - item.Quantity);
            }
        }

        order.CancelledAt = now;
    }

    private static bool IsAllowedTransition(DomainOrderStatus current, DomainOrderStatus next) =>
        (current, next) switch
        {
            (DomainOrderStatus.PendingConfirmation, DomainOrderStatus.Confirmed) => true,
            (DomainOrderStatus.PendingConfirmation, DomainOrderStatus.Cancelled) => true,
            (DomainOrderStatus.Confirmed, DomainOrderStatus.Preparing) => true,
            (DomainOrderStatus.Confirmed, DomainOrderStatus.Delivered) => true,
            (DomainOrderStatus.Confirmed, DomainOrderStatus.Cancelled) => true,
            (DomainOrderStatus.Preparing, DomainOrderStatus.Ready) => true,
            (DomainOrderStatus.Preparing, DomainOrderStatus.Cancelled) => true,
            (DomainOrderStatus.Ready, DomainOrderStatus.Delivered) => true,
            (DomainOrderStatus.Ready, DomainOrderStatus.Cancelled) => true,
            _ => false
        };

    private static void ValidateCreateRequest(CreateOrderRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName)) throw new ArgumentException("Full name is required.");
        if (string.IsNullOrWhiteSpace(request.PhoneNumber)) throw new ArgumentException("Phone number is required.");
        if (!Enum.IsDefined(request.PaymentMethod)) throw new ArgumentException("Payment method is invalid.");
        if (!Enum.IsDefined(request.DeliveryMethod)) throw new ArgumentException("Delivery method is invalid.");
        if (request.DeliveryMethod == DeliveryMethod.Delivery &&
            !request.CustomerAddressId.HasValue &&
            string.IsNullOrWhiteSpace(request.AddressLine))
        {
            throw new ArgumentException("A saved address or address line is required for delivery orders.");
        }

        if (request.Items is null || request.Items.Count == 0)
        {
            throw new ArgumentException("At least one order item is required.");
        }

        var duplicateItemId = request.Items.GroupBy(item => item.DailyMenuItemId)
            .FirstOrDefault(group => group.Count() > 1)?.Key;
        if (duplicateItemId.HasValue)
        {
            throw new ArgumentException($"Daily menu item id {duplicateItemId.Value} appears more than once.");
        }

        if (request.Items.Any(item => item.DailyMenuItemId <= 0 || item.Quantity <= 0))
        {
            throw new ArgumentException("Order item ids and quantities must be greater than zero.");
        }
    }

    private async Task<string> GenerateOrderNumberAsync(
        DateTime createdAtUtc,
        CancellationToken cancellationToken)
    {
        var persianYear = GetPersianBusinessYear(createdAtUtc);
        var prefix = persianYear.ToString(CultureInfo.InvariantCulture);
        var nextCounter = await orderRepository.GetMaxOrderNumberCounterAsync(prefix, cancellationToken) + 1;
        return $"{prefix}{nextCounter.ToString(CultureInfo.InvariantCulture)}";
    }

    private static int GetPersianBusinessYear(DateTime createdAtUtc)
    {
        var localCreatedAt = TimeZoneInfo.ConvertTimeFromUtc(createdAtUtc, BusinessTimeZone);
        return PersianCalendar.GetYear(localCreatedAt);
    }

    private static readonly PersianCalendar PersianCalendar = new();

    private static TimeZoneInfo BusinessTimeZone { get; } = ResolveBusinessTimeZone();

    private static TimeZoneInfo ResolveBusinessTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Iran Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Tehran");
        }
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizePhoneNumber(string value)
    {
        var normalizedDigits = value
            .Trim()
            .Select(character => character switch
            {
                >= '۰' and <= '۹' => (char)('0' + character - '۰'),
                >= '٠' and <= '٩' => (char)('0' + character - '٠'),
                _ => character
            });

        return new string(normalizedDigits
            .Where(character => char.IsDigit(character) || character == '+')
            .ToArray());
    }

    private sealed record TelegramIdentity(
        long? UserId,
        string? Username,
        string? FirstName,
        string? LastName);

    private static OrderSummaryDto MapSummary(Order order) => new()
    {
        Id = order.Id,
        OrderNumber = order.OrderNumber,
        CustomerFullName = order.DeliveryFullName,
        CustomerPhoneNumber = order.DeliveryPhoneNumber,
        Status = (OrderStatus)order.Status,
        TotalAmount = order.TotalAmount,
        PaymentMethod = (PaymentMethod)order.PaymentMethod,
        DeliveryMethod = (DeliveryMethod)order.DeliveryMethod,
        CreatedAt = order.CreatedAt,
        TotalQuantity = order.Items.Sum(item => item.Quantity),
        FoodSummary = string.Join("، ", order.Items
            .OrderBy(item => item.Id)
            .Select(item => $"{item.FoodName} × {item.Quantity.ToString(CultureInfo.InvariantCulture)}"))
    };

    private static OrderDto Map(Order order) => new()
    {
        Id = order.Id,
        OrderNumber = order.OrderNumber,
        CustomerId = order.CustomerProfileId,
        CustomerFullName = order.DeliveryFullName,
        CustomerPhoneNumber = order.DeliveryPhoneNumber,
        AddressLine = order.DeliveryAddressLine,
        AddressDescription = order.DeliveryAddressDescription,
        Status = (OrderStatus)order.Status,
        PaymentMethod = (PaymentMethod)order.PaymentMethod,
        DeliveryMethod = (DeliveryMethod)order.DeliveryMethod,
        SubtotalAmount = order.SubtotalAmount,
        DeliveryFee = order.DeliveryFee,
        TotalAmount = order.TotalAmount,
        CustomerNote = order.CustomerNote,
        AdminNote = order.AdminNote,
        CreatedAt = order.CreatedAt,
        ConfirmedAt = order.ConfirmedAt,
        DeliveredAt = order.DeliveredAt,
        CancelledAt = order.CancelledAt,
        Items = order.Items.OrderBy(item => item.Id).Select(item => new OrderItemDto
        {
            Id = item.Id,
            DailyMenuItemId = item.DailyMenuItemId,
            FoodName = item.FoodName,
            UnitPrice = item.UnitPrice,
            Quantity = item.Quantity,
            TotalPrice = item.TotalPrice
        }).ToList(),
        StatusHistories = order.StatusHistories.OrderBy(history => history.ChangedAt)
            .Select(history => new OrderStatusHistoryDto
            {
                FromStatus = (OrderStatus)history.FromStatus,
                ToStatus = (OrderStatus)history.ToStatus,
                Note = history.Note,
                ChangedAt = history.ChangedAt
            }).ToList()
    };
}
