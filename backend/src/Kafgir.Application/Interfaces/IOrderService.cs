using Kafgir.Contracts.Orders;

namespace Kafgir.Application.Interfaces;

public interface IOrderService
{
    Task<OrderDto> CreateAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken = default);
    Task<OrderDto> CreateAdminAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OrderSummaryDto>> GetByDateAsync(
        DateOnly date,
        OrderStatus? status = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OrderSummaryDto>> SearchAsync(
        OrderReportQuery query,
        CancellationToken cancellationToken = default);

    Task<OrderDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    Task<bool> UpdateStatusAsync(
        int id,
        UpdateOrderStatusRequest request,
        CancellationToken cancellationToken = default);
}
