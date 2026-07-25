using Kafgir.Application.Common;
using Kafgir.Application.Interfaces;
using Kafgir.Contracts.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kafgir.Api.Controllers;

[ApiController]
[Authorize(Roles = AppRoles.AdminRoleList)]
[Route("api/admin/orders")]
public sealed class AdminOrdersController(IOrderService orderService) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<OrderDto>> Create(
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var order = await orderService.CreateAdminAsync(request, cancellationToken);
            return Created($"/api/admin/orders/{order.Id}", order);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrderSummaryDto>>> GetByDate(
        [FromQuery] DateOnly? date,
        [FromQuery] OrderStatus? status,
        [FromQuery] string? orderNumber,
        [FromQuery] string? customerName,
        [FromQuery] string? phoneNumber,
        [FromQuery] DeliveryMethod? deliveryMethod,
        [FromQuery] PaymentMethod? paymentMethod,
        [FromQuery] string? foodName,
        CancellationToken cancellationToken)
    {
        if (!date.HasValue)
        {
            return BadRequest(new { error = "The date query parameter is required (yyyy-MM-dd)." });
        }

        try
        {
            var query = new OrderReportQuery
            {
                Date = date.Value,
                Status = status,
                OrderNumber = orderNumber,
                CustomerName = customerName,
                PhoneNumber = phoneNumber,
                DeliveryMethod = deliveryMethod,
                PaymentMethod = paymentMethod,
                FoodName = foodName
            };

            return Ok(await orderService.SearchAsync(query, cancellationToken));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDto>> GetById(
        int id,
        CancellationToken cancellationToken)
    {
        var order = await orderService.GetByIdAsync(id, cancellationToken);
        return order is null ? NotFound() : Ok(order);
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(
        int id,
        UpdateOrderStatusRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return await orderService.UpdateStatusAsync(id, request, cancellationToken)
                ? NoContent()
                : NotFound();
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
    }
}
