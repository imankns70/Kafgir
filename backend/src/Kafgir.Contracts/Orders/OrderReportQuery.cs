namespace Kafgir.Contracts.Orders;

public sealed class OrderReportQuery
{
    public DateOnly Date { get; set; }
    public OrderStatus? Status { get; set; }
    public string? OrderNumber { get; set; }
    public string? CustomerName { get; set; }
    public string? PhoneNumber { get; set; }
    public DeliveryMethod? DeliveryMethod { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public string? FoodName { get; set; }
}
