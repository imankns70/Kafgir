using Kafgir.Application.Interfaces;
using Kafgir.Contracts.Orders;
using Kafgir.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using DomainDeliveryMethod = Kafgir.Domain.Enums.DeliveryMethod;
using DomainOrderStatus = Kafgir.Domain.Enums.OrderStatus;
using DomainPaymentMethod = Kafgir.Domain.Enums.PaymentMethod;

namespace Kafgir.Infrastructure.Persistence.Repositories;

public sealed class OrderRepository(KafgirDbContext dbContext) : IOrderRepository
{
    public Task<Order?> GetByIdAsync(int id, CancellationToken cancellationToken = default) =>
        dbContext.Orders
            .AsNoTracking()
            .Include(order => order.CustomerProfile)
            .Include(order => order.CustomerAddress)
            .Include(order => order.Items)
            .Include(order => order.StatusHistories)
            .SingleOrDefaultAsync(order => order.Id == id, cancellationToken);

    public Task<Order?> GetByIdWithDetailsAsync(
        int id,
        CancellationToken cancellationToken = default) =>
        dbContext.Orders
            .Include(order => order.CustomerProfile)
            .Include(order => order.CustomerAddress)
            .Include(order => order.Items)
            .ThenInclude(item => item.DailyMenuItem)
            .Include(order => order.StatusHistories)
            .SingleOrDefaultAsync(order => order.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Order>> GetByDateAsync(
        DateOnly date,
        DomainOrderStatus? status = null,
        CancellationToken cancellationToken = default)
    {
        var start = ToUtcBusinessDateBoundary(date);
        var end = ToUtcBusinessDateBoundary(date.AddDays(1));

        var query = dbContext.Orders
            .AsNoTracking()
            .Include(order => order.CustomerProfile)
            .Include(order => order.Items)
            .Where(order => order.CreatedAt >= start && order.CreatedAt < end);

        if (status.HasValue)
        {
            query = query.Where(order => order.Status == status.Value);
        }

        return await query
            .OrderByDescending(order => order.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Order>> SearchAsync(
        OrderReportQuery reportQuery,
        CancellationToken cancellationToken = default)
    {
        var start = ToUtcBusinessDateBoundary(reportQuery.Date);
        var end = ToUtcBusinessDateBoundary(reportQuery.Date.AddDays(1));

        var query = dbContext.Orders
            .AsNoTracking()
            .Include(order => order.CustomerProfile)
            .Include(order => order.Items)
            .Where(order => order.CreatedAt >= start && order.CreatedAt < end);

        if (reportQuery.Status.HasValue)
        {
            var status = (DomainOrderStatus)reportQuery.Status.Value;
            query = query.Where(order => order.Status == status);
        }

        if (reportQuery.DeliveryMethod.HasValue)
        {
            var deliveryMethod = (DomainDeliveryMethod)reportQuery.DeliveryMethod.Value;
            query = query.Where(order => order.DeliveryMethod == deliveryMethod);
        }

        if (reportQuery.PaymentMethod.HasValue)
        {
            var paymentMethod = (DomainPaymentMethod)reportQuery.PaymentMethod.Value;
            query = query.Where(order => order.PaymentMethod == paymentMethod);
        }

        var orderNumber = NormalizeSearch(reportQuery.OrderNumber);
        if (orderNumber is not null)
        {
            query = query.Where(order => order.OrderNumber.Contains(orderNumber));
        }

        var customerName = NormalizeSearch(reportQuery.CustomerName);
        if (customerName is not null)
        {
            query = query.Where(order => order.DeliveryFullName.Contains(customerName));
        }

        var phoneNumber = NormalizeSearch(reportQuery.PhoneNumber);
        if (phoneNumber is not null)
        {
            query = query.Where(order => order.DeliveryPhoneNumber.Contains(phoneNumber));
        }

        var foodName = NormalizeSearch(reportQuery.FoodName);
        if (foodName is not null)
        {
            query = query.Where(order => order.Items.Any(item => item.FoodName.Contains(foodName)));
        }

        return await query
            .OrderByDescending(order => order.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetMaxOrderNumberCounterAsync(
        string persianYearPrefix,
        CancellationToken cancellationToken = default)
    {
        var orderNumbers = await dbContext.Orders
            .AsNoTracking()
            .Where(order => order.OrderNumber.StartsWith(persianYearPrefix))
            .Select(order => order.OrderNumber)
            .ToListAsync(cancellationToken);

        return orderNumbers
            .Select(orderNumber => int.TryParse(orderNumber[persianYearPrefix.Length..], out var counter)
                ? counter
                : 0)
            .DefaultIfEmpty(0)
            .Max();
    }

    public async Task AddAsync(Order order, CancellationToken cancellationToken = default) =>
        await dbContext.Orders.AddAsync(order, cancellationToken);

    private static DateTime ToUtcBusinessDateBoundary(DateOnly date)
    {
        var localDateTime = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localDateTime, BusinessTimeZone);
    }

    private static string? NormalizeSearch(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
}
