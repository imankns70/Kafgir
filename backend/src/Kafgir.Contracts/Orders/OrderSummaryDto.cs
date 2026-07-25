namespace Kafgir.Contracts.Orders;

public sealed class OrderSummaryDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerFullName { get; set; } = string.Empty;
    public string CustomerPhoneNumber { get; set; } = string.Empty;
    public OrderStatus Status { get; set; }
    public decimal TotalAmount { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public DeliveryMethod DeliveryMethod { get; set; }
    public DateTime CreatedAt { get; set; }
    public int TotalQuantity { get; set; }
    public string FoodSummary { get; set; } = string.Empty;
}
