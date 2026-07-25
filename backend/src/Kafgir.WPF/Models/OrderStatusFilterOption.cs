using Kafgir.Contracts.Orders;

namespace Kafgir.WPF.Models;

public sealed record OrderStatusFilterOption(string DisplayName, OrderStatus? Value)
{
    public override string ToString() => DisplayName;
}
