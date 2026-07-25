using Kafgir.Domain.Entities;
using Kafgir.Contracts.Orders;
using DomainOrderStatus = Kafgir.Domain.Enums.OrderStatus;

namespace Kafgir.Application.Interfaces;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<Order?> GetByIdWithDetailsAsync(int id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Order>> GetByDateAsync(
        DateOnly date,
        DomainOrderStatus? status = null,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Order>> SearchAsync(
        OrderReportQuery query,
        CancellationToken cancellationToken = default);
    Task<int> GetMaxOrderNumberCounterAsync(string persianYearPrefix, CancellationToken cancellationToken = default);
    Task AddAsync(Order order, CancellationToken cancellationToken = default);
}
