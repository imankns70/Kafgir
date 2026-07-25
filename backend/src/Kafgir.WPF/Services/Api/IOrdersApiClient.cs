using Kafgir.Contracts.Orders;

namespace Kafgir.WPF.Services.Api;

public interface IOrdersApiClient
{
    Task<IReadOnlyList<OrderSummaryDto>> GetOrdersAsync(
        DateOnly date,
        OrderStatus? status = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OrderSummaryDto>> SearchOrdersAsync(
        OrderReportQuery query,
        CancellationToken cancellationToken = default);

    Task<OrderDto?> GetOrderAsync(int id, CancellationToken cancellationToken = default);

    Task<OrderDto> CreateOrderAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken = default);

    Task UpdateStatusAsync(
        int id,
        UpdateOrderStatusRequest request,
        CancellationToken cancellationToken = default);
}
