namespace Kafgir.Contracts.Admin;

public sealed class AdminDashboardSummaryDto
{
    public DateOnly Date { get; init; }
    public int TotalOrders { get; init; }
    public int PendingOrders { get; init; }
    public int ConfirmedOrders { get; init; }
    public int PreparingOrders { get; init; }
    public int ReadyOrders { get; init; }
    public int DeliveredOrders { get; init; }
    public int CancelledOrders { get; init; }
    public int ActiveOrders { get; init; }
    public int TotalPortions { get; init; }
    public decimal GrossSales { get; init; }
    public decimal ConfirmedSales { get; init; }
    public decimal DeliveredSales { get; init; }
    public int TodayMenuItems { get; init; }
    public bool IsTodayMenuOpen { get; init; }
}
