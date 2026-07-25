using System.Collections.ObjectModel;
using System.Net.Http;
using System.Windows.Threading;
using Kafgir.WPF.Models;
using Kafgir.WPF.Services.Api;
using Kafgir.Contracts.Orders;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;

namespace Kafgir.WPF.ViewModels;

public sealed class OrdersViewModel : ObservableObject, IDisposable
{
    private readonly IOrdersApiClient _apiClient;
    private readonly DispatcherTimer _pollTimer;
    private DateTime _selectedDate = DateTime.Today;
    private OrderStatusFilterOption _selectedStatusFilter;
    private OrderSummaryDto? _selectedOrder;
    private bool _isBusy;
    private bool _isAutoRefreshEnabled = true;
    private string? _orderNumberSearch;
    private string? _errorMessage;
    private string? _successMessage;

    public OrdersViewModel(IOrdersApiClient apiClient)
    {
        _apiClient = apiClient;
        StatusFilters =
        [
            new("همه وضعیت‌ها", null),
            new("در انتظار تایید", OrderStatus.PendingConfirmation),
            new("تایید شده", OrderStatus.Confirmed),
            new("در حال آماده‌سازی", OrderStatus.Preparing),
            new("آماده تحویل", OrderStatus.Ready),
            new("تحویل شده", OrderStatus.Delivered),
            new("لغو شده", OrderStatus.Cancelled)
        ];
        _selectedStatusFilter = StatusFilters[0];

        LoadOrdersCommand = new AsyncRelayCommand(LoadOrdersAsync, () => !IsBusy);
        RefreshCommand = new AsyncRelayCommand(LoadOrdersAsync, () => !IsBusy);
        LoadOrderDetailsCommand = new AsyncRelayCommand(LoadOrderDetailsAsync, CanUseSelectedOrder);
        ConfirmOrderCommand = CreateStatusCommand(OrderStatus.Confirmed);
        SetDeliveredCommand = CreateStatusCommand(OrderStatus.Delivered);
        CancelOrderCommand = CreateStatusCommand(OrderStatus.Cancelled);

        _pollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(10) };
        _pollTimer.Tick += PollTimerOnTick;
    }

    public ObservableCollection<OrderSummaryDto> Orders { get; } = [];
    public PaginationViewModel<OrderSummaryDto> OrdersPagination { get; } = new(12);
    public IReadOnlyList<OrderStatusFilterOption> StatusFilters { get; }
    public OrderDetailsViewModel Details { get; } = new();

    public DateTime SelectedDate
    {
        get => _selectedDate;
        set => SetProperty(ref _selectedDate, value);
    }

    public OrderStatusFilterOption SelectedStatusFilter
    {
        get => _selectedStatusFilter;
        set => SetProperty(ref _selectedStatusFilter, value);
    }

    public OrderSummaryDto? SelectedOrder
    {
        get => _selectedOrder;
        set
        {
            if (!SetProperty(ref _selectedOrder, value))
            {
                return;
            }

            NotifyCommandStates();
            if (value is not null)
            {
                LoadOrderDetailsCommand.Execute(null);
            }
            else
            {
                Details.Order = null;
            }
        }
    }

    public OrderDto? SelectedOrderDetails => Details.Order;

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                NotifyCommandStates();
            }
        }
    }

    public string? ErrorMessage
    {
        get => _errorMessage;
        private set => SetProperty(ref _errorMessage, value);
    }

    public string? SuccessMessage
    {
        get => _successMessage;
        private set => SetProperty(ref _successMessage, value);
    }

    public bool IsAutoRefreshEnabled
    {
        get => _isAutoRefreshEnabled;
        set
        {
            if (!SetProperty(ref _isAutoRefreshEnabled, value))
            {
                return;
            }

            if (value)
            {
                StartPolling();
            }
            else
            {
                _pollTimer.Stop();
            }
        }
    }

    public string? OrderNumberSearch
    {
        get => _orderNumberSearch;
        set => SetProperty(ref _orderNumberSearch, value);
    }

    public IAsyncRelayCommand LoadOrdersCommand { get; }
    public IAsyncRelayCommand RefreshCommand { get; }
    public IAsyncRelayCommand LoadOrderDetailsCommand { get; }
    public IAsyncRelayCommand<OrderSummaryDto?> ConfirmOrderCommand { get; }
    public IAsyncRelayCommand<OrderSummaryDto?> SetDeliveredCommand { get; }
    public IAsyncRelayCommand<OrderSummaryDto?> CancelOrderCommand { get; }

    public void Dispose()
    {
        _pollTimer.Stop();
        _pollTimer.Tick -= PollTimerOnTick;
    }

    public void StartPolling()
    {
        if (IsAutoRefreshEnabled && !_pollTimer.IsEnabled)
        {
            _pollTimer.Start();
        }
    }

    public void ResetForLogout()
    {
        _pollTimer.Stop();
        Orders.Clear();
        OrdersPagination.SetItems([]);
        SelectedOrder = null;
        OrderNumberSearch = null;
        ErrorMessage = null;
        SuccessMessage = null;
    }

    private IAsyncRelayCommand<OrderSummaryDto?> CreateStatusCommand(OrderStatus status) =>
        new AsyncRelayCommand<OrderSummaryDto?>(
            order => UpdateStatusAsync(status, order),
            order => CanChangeOrderStatus(order, status));

    private async Task LoadOrdersAsync()
    {
        if (IsBusy)
        {
            return;
        }

        SelectedDate = DateTime.Today;
        var selectedId = SelectedOrder?.Id;
        var shouldRefreshSelectedDetails = false;
        IsBusy = true;
        ErrorMessage = null;

        try
        {
            var orders = await _apiClient.GetOrdersAsync(
                DateOnly.FromDateTime(SelectedDate),
                SelectedStatusFilter.Value);
            var normalizedOrderNumberSearch = OrderNumberSearch?.Trim();
            if (!string.IsNullOrWhiteSpace(normalizedOrderNumberSearch))
            {
                orders = orders
                    .Where(order => order.OrderNumber.Contains(
                        normalizedOrderNumberSearch,
                        StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            Orders.Clear();
            foreach (var order in orders)
            {
                Orders.Add(order);
            }
            OrdersPagination.SetItems(Orders, resetPage: false);

            var refreshedSelection = selectedId.HasValue
                ? Orders.FirstOrDefault(order => order.Id == selectedId.Value)
                : null;

            if (!ReferenceEquals(_selectedOrder, refreshedSelection))
            {
                _selectedOrder = refreshedSelection;
                OnPropertyChanged(nameof(SelectedOrder));
                NotifyCommandStates();
            }

            if (refreshedSelection is null && selectedId.HasValue)
            {
                Details.Order = null;
            }
            else if (refreshedSelection is not null && Details.Order?.Id == refreshedSelection.Id)
            {
                shouldRefreshSelectedDetails = true;
            }
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            ErrorMessage = $"ارتباط با API برقرار نشد: {exception.Message}";
        }
        finally
        {
            IsBusy = false;
        }

        if (shouldRefreshSelectedDetails)
        {
            await LoadOrderDetailsAsync();
        }
    }

    private async Task LoadOrderDetailsAsync()
    {
        if (SelectedOrder is null || IsBusy)
        {
            return;
        }

        await LoadOrderDetailsByIdAsync(SelectedOrder.Id);
    }

    private async Task LoadOrderDetailsByIdAsync(int orderId)
    {
        if (IsBusy)
        {
            return;
        }

        IsBusy = true;
        ErrorMessage = null;
        try
        {
            Details.Order = await _apiClient.GetOrderAsync(orderId);
            OnPropertyChanged(nameof(SelectedOrderDetails));
            if (Details.Order is null)
            {
                ErrorMessage = "سفارش پیدا نشد.";
            }
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            ErrorMessage = $"دریافت جزئیات سفارش ناموفق بود: {exception.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task UpdateStatusAsync(OrderStatus status, OrderSummaryDto? order)
    {
        var targetOrder = order ?? SelectedOrder;
        if (targetOrder is null || IsBusy)
        {
            return;
        }

        var orderId = targetOrder.Id;
        IsBusy = true;
        ErrorMessage = null;
        SuccessMessage = null;

        try
        {
            await _apiClient.UpdateStatusAsync(orderId, new UpdateOrderStatusRequest
            {
                NewStatus = status
            });
            SuccessMessage = "وضعیت سفارش با موفقیت به‌روزرسانی شد.";
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            ErrorMessage = $"تغییر وضعیت سفارش ناموفق بود: {exception.Message}";
            return;
        }
        finally
        {
            IsBusy = false;
        }

        await LoadOrdersAsync();
        await LoadOrderDetailsByIdAsync(orderId);
    }

    private bool CanUseSelectedOrder() => SelectedOrder is not null && !IsBusy;

    private bool CanChangeOrderStatus(OrderSummaryDto? order, OrderStatus targetStatus)
    {
        order ??= SelectedOrder;
        if (order is null || IsBusy)
        {
            return false;
        }

        return (order.Status, targetStatus) switch
        {
            (OrderStatus.PendingConfirmation, OrderStatus.Confirmed) => true,
            (OrderStatus.Confirmed, OrderStatus.Delivered) => true,
            (OrderStatus.Ready, OrderStatus.Delivered) => true,
            (OrderStatus.PendingConfirmation, OrderStatus.Cancelled) => true,
            (OrderStatus.Confirmed, OrderStatus.Cancelled) => true,
            (OrderStatus.Preparing, OrderStatus.Cancelled) => true,
            (OrderStatus.Ready, OrderStatus.Cancelled) => true,
            _ => false
        };
    }

    private void NotifyCommandStates()
    {
        LoadOrdersCommand?.NotifyCanExecuteChanged();
        RefreshCommand?.NotifyCanExecuteChanged();
        LoadOrderDetailsCommand?.NotifyCanExecuteChanged();
        ConfirmOrderCommand?.NotifyCanExecuteChanged();
        SetDeliveredCommand?.NotifyCanExecuteChanged();
        CancelOrderCommand?.NotifyCanExecuteChanged();
    }

    private void PollTimerOnTick(object? sender, EventArgs e)
    {
        if (IsAutoRefreshEnabled && !IsBusy)
        {
            RefreshCommand.Execute(null);
        }
    }
}
