using System.Globalization;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using Kafgir.Contracts.Orders;

namespace Kafgir.WPF.Services.Api;

public sealed class OrdersApiClient(HttpClient httpClient) : IOrdersApiClient
{
    public async Task<IReadOnlyList<OrderSummaryDto>> GetOrdersAsync(
        DateOnly date,
        OrderStatus? status = null,
        CancellationToken cancellationToken = default)
    {
        var route = $"api/admin/orders?date={FormatApiDate(date)}";
        if (status.HasValue)
        {
            route += $"&status={(int)status.Value}";
        }

        using var response = await httpClient.GetAsync(route, cancellationToken);
        await ApiResponseHandler.EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<List<OrderSummaryDto>>(cancellationToken) ?? [];
    }

    public async Task<IReadOnlyList<OrderSummaryDto>> SearchOrdersAsync(
        OrderReportQuery query,
        CancellationToken cancellationToken = default)
    {
        var route = $"api/admin/orders?date={FormatApiDate(query.Date)}";
        if (query.Status.HasValue)
        {
            route += $"&status={(int)query.Status.Value}";
        }

        if (query.DeliveryMethod.HasValue)
        {
            route += $"&deliveryMethod={(int)query.DeliveryMethod.Value}";
        }

        if (query.PaymentMethod.HasValue)
        {
            route += $"&paymentMethod={(int)query.PaymentMethod.Value}";
        }

        route = AppendQuery(route, "orderNumber", query.OrderNumber);
        route = AppendQuery(route, "customerName", query.CustomerName);
        route = AppendQuery(route, "phoneNumber", query.PhoneNumber);
        route = AppendQuery(route, "foodName", query.FoodName);

        using var response = await httpClient.GetAsync(route, cancellationToken);
        await ApiResponseHandler.EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<List<OrderSummaryDto>>(cancellationToken) ?? [];
    }

    public async Task<OrderDto?> GetOrderAsync(int id, CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync($"api/admin/orders/{id}", cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        await ApiResponseHandler.EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<OrderDto>(cancellationToken);
    }

    public async Task<OrderDto> CreateOrderAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PostAsJsonAsync(
            "api/admin/orders", request, cancellationToken);
        await ApiResponseHandler.EnsureSuccessAsync(response, cancellationToken);
        return await response.Content.ReadFromJsonAsync<OrderDto>(cancellationToken)
            ?? throw new HttpRequestException("پاسخ ثبت سفارش خالی بود.");
    }

    public async Task UpdateStatusAsync(
        int id,
        UpdateOrderStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.PatchAsJsonAsync(
            $"api/admin/orders/{id}/status", request, cancellationToken);
        await ApiResponseHandler.EnsureSuccessAsync(response, cancellationToken);
    }

    private static string FormatApiDate(DateOnly date) =>
        date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private static string AppendQuery(string route, string name, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return route;
        }

        return $"{route}&{name}={Uri.EscapeDataString(value.Trim())}";
    }
}
