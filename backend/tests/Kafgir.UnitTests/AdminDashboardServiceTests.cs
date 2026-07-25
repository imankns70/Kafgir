using Kafgir.Application.Interfaces;
using Kafgir.Application.Services;
using Kafgir.Domain.Entities;
using Kafgir.Domain.Enums;

namespace Kafgir.UnitTests;

public sealed class AdminDashboardServiceTests
{
    [Fact]
    public async Task GetToday_summarizes_orders_and_menu()
    {
        var businessDate = GetBusinessDate();
        var menu = new DailyMenu
        {
            MenuDate = businessDate,
            IsOpen = true,
            Items =
            {
                new DailyMenuItem { Id = 1, FoodId = 1 },
                new DailyMenuItem { Id = 2, FoodId = 2 }
            }
        };
        var orderRepository = new FakeOrderRepository([
                CreateOrder(OrderStatus.PendingConfirmation, 250_000, 2),
                CreateOrder(OrderStatus.Confirmed, 300_000, 3),
                CreateOrder(OrderStatus.Preparing, 180_000, 1),
                CreateOrder(OrderStatus.Ready, 120_000, 1),
                CreateOrder(OrderStatus.Delivered, 420_000, 4),
                CreateOrder(OrderStatus.Cancelled, 999_000, 9)
            ]);
        var menuRepository = new FakeDailyMenuRepository(menu);
        var service = new AdminDashboardService(orderRepository, menuRepository);

        var summary = await service.GetTodayAsync();

        Assert.Equal(businessDate, summary.Date);
        Assert.Equal(businessDate, orderRepository.RequestedDate);
        Assert.Equal(businessDate, menuRepository.RequestedDate);
        Assert.Equal(6, summary.TotalOrders);
        Assert.Equal(1, summary.PendingOrders);
        Assert.Equal(1, summary.ConfirmedOrders);
        Assert.Equal(1, summary.PreparingOrders);
        Assert.Equal(1, summary.ReadyOrders);
        Assert.Equal(1, summary.DeliveredOrders);
        Assert.Equal(1, summary.CancelledOrders);
        Assert.Equal(3, summary.ActiveOrders);
        Assert.Equal(20, summary.TotalPortions);
        Assert.Equal(1_270_000, summary.GrossSales);
        Assert.Equal(300_000, summary.ConfirmedSales);
        Assert.Equal(420_000, summary.DeliveredSales);
        Assert.True(summary.IsTodayMenuOpen);
        Assert.Equal(2, summary.TodayMenuItems);
    }

    private static Order CreateOrder(OrderStatus status, decimal totalAmount, int quantity)
    {
        var order = new Order
        {
            Status = status,
            TotalAmount = totalAmount,
            CreatedAt = DateTime.Today
        };
        order.Items.Add(new OrderItem
        {
            Order = order,
            Quantity = quantity
        });
        return order;
    }

    private static DateOnly GetBusinessDate()
    {
        TimeZoneInfo timeZone;
        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById("Iran Standard Time");
        }
        catch (TimeZoneNotFoundException)
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tehran");
        }

        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone));
    }

    private sealed class FakeOrderRepository(IReadOnlyList<Order> orders) : IOrderRepository
    {
        public DateOnly? RequestedDate { get; private set; }

        public Task<Order?> GetByIdAsync(int id, CancellationToken cancellationToken = default) =>
            Task.FromResult<Order?>(null);

        public Task<Order?> GetByIdWithDetailsAsync(int id, CancellationToken cancellationToken = default) =>
            Task.FromResult<Order?>(null);

        public Task<IReadOnlyList<Order>> GetByDateAsync(
            DateOnly date,
            OrderStatus? status = null,
            CancellationToken cancellationToken = default)
        {
            RequestedDate = date;
            return Task.FromResult<IReadOnlyList<Order>>(status.HasValue
                ? orders.Where(order => order.Status == status.Value).ToList()
                : orders);
        }

        public Task<IReadOnlyList<Order>> SearchAsync(
            Kafgir.Contracts.Orders.OrderReportQuery query,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(orders);

        public Task<int> GetMaxOrderNumberCounterAsync(string persianYearPrefix, CancellationToken cancellationToken = default) =>
            Task.FromResult(0);

        public Task AddAsync(Order order, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakeDailyMenuRepository(DailyMenu? menu) : IDailyMenuRepository
    {
        public DateOnly? RequestedDate { get; private set; }

        public Task<DailyMenu?> GetByDateAsync(
            DateOnly date,
            CancellationToken cancellationToken = default)
        {
            RequestedDate = date;
            return Task.FromResult(menu);
        }

        public Task<DailyMenu?> GetByIdAsync(int id, CancellationToken cancellationToken = default) =>
            Task.FromResult<DailyMenu?>(null);

        public Task<DailyMenuItem?> GetItemByIdAsync(int id, CancellationToken cancellationToken = default) =>
            Task.FromResult<DailyMenuItem?>(null);

        public Task<bool> IsItemBookedAsync(int id, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task AddAsync(DailyMenu dailyMenu, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
