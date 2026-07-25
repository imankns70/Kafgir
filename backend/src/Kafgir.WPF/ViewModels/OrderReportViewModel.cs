using System.Collections.ObjectModel;
using System.Globalization;
using System.Net.Http;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Kafgir.Contracts.Orders;
using Kafgir.WPF.Models;
using Kafgir.WPF.Services.Api;

namespace Kafgir.WPF.ViewModels;

public sealed class OrderReportViewModel : ObservableObject
{
    private readonly IOrdersApiClient _apiClient;
    private readonly IFoodsApiClient _foodsApiClient;
    private DateTime _selectedDate = DateTime.Today;
    private SelectOption<OrderStatus?> _selectedStatusFilter;
    private SelectOption<DeliveryMethod?> _selectedDeliveryMethod;
    private SelectOption<PaymentMethod?> _selectedPaymentMethod;
    private SelectOption<string?> _selectedFood;
    private OrderSummaryDto? _selectedOrder;
    private bool _isBusy;
    private string? _orderNumberSearch;
    private string? _customerNameSearch;
    private string? _phoneNumberSearch;
    private string? _errorMessage;
    private string? _successMessage;
    private bool _isDetailPageVisible;
    private bool _foodsLoaded;

    public OrderReportViewModel(IOrdersApiClient apiClient, IFoodsApiClient foodsApiClient)
    {
        _apiClient = apiClient;
        _foodsApiClient = foodsApiClient;

        StatusFilters =
        [
            new(null, "همه وضعیت‌ها"),
            new(OrderStatus.PendingConfirmation, "در انتظار تایید"),
            new(OrderStatus.Confirmed, "تایید شده"),
            new(OrderStatus.Preparing, "در حال آماده‌سازی"),
            new(OrderStatus.Ready, "آماده تحویل"),
            new(OrderStatus.Delivered, "تحویل شده"),
            new(OrderStatus.Cancelled, "لغو شده")
        ];
        DeliveryMethods =
        [
            new(null, "همه روش‌های دریافت"),
            new(DeliveryMethod.Pickup, "تحویل حضوری"),
            new(DeliveryMethod.Delivery, "ارسال")
        ];
        PaymentMethods =
        [
            new(null, "همه روش‌های فروش"),
            new(PaymentMethod.CardToCard, "کارت‌به‌کارت"),
            new(PaymentMethod.Cash, "نقدی"),
            new(PaymentMethod.Online, "آنلاین")
        ];

        _selectedStatusFilter = StatusFilters[0];
        _selectedDeliveryMethod = DeliveryMethods[0];
        _selectedPaymentMethod = PaymentMethods[0];
        Foods.Add(new SelectOption<string?>(null, "همه غذاها"));
        _selectedFood = Foods[0];

        SearchCommand = new AsyncRelayCommand(SearchAsync, () => !IsBusy);
        ClearFiltersCommand = new RelayCommand(ClearFilters, () => !IsBusy);
        ShowDetailsCommand = new AsyncRelayCommand<OrderSummaryDto?>(ShowDetailsAsync, order => order is not null && !IsBusy);
        BackToReportCommand = new RelayCommand(BackToReport);
    }

    public ObservableCollection<OrderSummaryDto> Orders { get; } = [];
    public ObservableCollection<SelectOption<string?>> Foods { get; } = [];
    public PaginationViewModel<OrderSummaryDto> OrdersPagination { get; } = new(14);
    public OrderDetailsViewModel Details { get; } = new();
    public IReadOnlyList<SelectOption<OrderStatus?>> StatusFilters { get; }
    public IReadOnlyList<SelectOption<DeliveryMethod?>> DeliveryMethods { get; }
    public IReadOnlyList<SelectOption<PaymentMethod?>> PaymentMethods { get; }

    public DateTime SelectedDate { get => _selectedDate; set => SetProperty(ref _selectedDate, value); }
    public SelectOption<OrderStatus?> SelectedStatusFilter { get => _selectedStatusFilter; set => SetProperty(ref _selectedStatusFilter, value); }
    public SelectOption<DeliveryMethod?> SelectedDeliveryMethod { get => _selectedDeliveryMethod; set => SetProperty(ref _selectedDeliveryMethod, value); }
    public SelectOption<PaymentMethod?> SelectedPaymentMethod { get => _selectedPaymentMethod; set => SetProperty(ref _selectedPaymentMethod, value); }
    public string? OrderNumberSearch { get => _orderNumberSearch; set => SetProperty(ref _orderNumberSearch, value); }
    public string? CustomerNameSearch { get => _customerNameSearch; set => SetProperty(ref _customerNameSearch, value); }
    public string? PhoneNumberSearch { get => _phoneNumberSearch; set => SetProperty(ref _phoneNumberSearch, value); }
    public SelectOption<string?> SelectedFood { get => _selectedFood; set => SetProperty(ref _selectedFood, value); }
    public OrderSummaryDto? SelectedOrder { get => _selectedOrder; set => SetProperty(ref _selectedOrder, value); }
    public string ResultSummary => $"{Orders.Count:N0} سفارش";
    public bool IsDetailPageVisible { get => _isDetailPageVisible; private set => SetProperty(ref _isDetailPageVisible, value); }

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                SearchCommand.NotifyCanExecuteChanged();
                ClearFiltersCommand.NotifyCanExecuteChanged();
                ShowDetailsCommand.NotifyCanExecuteChanged();
            }
        }
    }

    public string? ErrorMessage { get => _errorMessage; private set => SetProperty(ref _errorMessage, value); }
    public string? SuccessMessage { get => _successMessage; private set => SetProperty(ref _successMessage, value); }

    public IAsyncRelayCommand SearchCommand { get; }
    public IRelayCommand ClearFiltersCommand { get; }
    public IAsyncRelayCommand<OrderSummaryDto?> ShowDetailsCommand { get; }
    public IRelayCommand BackToReportCommand { get; }

    public async Task LoadAsync()
    {
        await LoadFoodsAsync();
        await SearchAsync();
    }

    public void ResetForLogout()
    {
        Orders.Clear();
        OrdersPagination.SetItems([]);
        SelectedOrder = null;
        Details.Order = null;
        IsDetailPageVisible = false;
        ErrorMessage = null;
        SuccessMessage = null;
    }

    private async Task SearchAsync()
    {
        if (IsBusy)
        {
            return;
        }

        IsBusy = true;
        ErrorMessage = null;
        SuccessMessage = null;
        SelectedOrder = null;
        Details.Order = null;
        IsDetailPageVisible = false;

        try
        {
            await LoadFoodsAsync();

            var orders = await _apiClient.SearchOrdersAsync(new OrderReportQuery
            {
                Date = DateOnly.FromDateTime(SelectedDate),
                Status = SelectedStatusFilter.Value,
                DeliveryMethod = SelectedDeliveryMethod.Value,
                PaymentMethod = SelectedPaymentMethod.Value,
                OrderNumber = OrderNumberSearch,
                CustomerName = CustomerNameSearch,
                PhoneNumber = PhoneNumberSearch,
                FoodName = SelectedFood.Value
            });

            await PopulateMissingFoodSummariesAsync(orders);

            Orders.Clear();
            foreach (var order in orders)
            {
                Orders.Add(order);
            }

            OrdersPagination.SetItems(Orders);
            OnPropertyChanged(nameof(ResultSummary));
            SuccessMessage = Orders.Count == 0 ? "موردی برای این فیلترها پیدا نشد." : null;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            ErrorMessage = $"دریافت گزارش ناموفق بود: {exception.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task PopulateMissingFoodSummariesAsync(IReadOnlyList<OrderSummaryDto> orders)
    {
        foreach (var order in orders.Where(order => string.IsNullOrWhiteSpace(order.FoodSummary)))
        {
            var details = await _apiClient.GetOrderAsync(order.Id);
            if (details is null || details.Items.Count == 0)
            {
                continue;
            }

            order.FoodSummary = string.Join("، ", details.Items
                .OrderBy(item => item.Id)
                .Select(item => $"{item.FoodName} × {item.Quantity.ToString(CultureInfo.InvariantCulture)}"));
            order.TotalQuantity = details.Items.Sum(item => item.Quantity);
        }
    }

    private async Task ShowDetailsAsync(OrderSummaryDto? order)
    {
        if (order is null || IsBusy)
        {
            return;
        }

        IsBusy = true;
        ErrorMessage = null;
        SelectedOrder = order;

        try
        {
            Details.Order = await _apiClient.GetOrderAsync(order.Id);
            if (Details.Order is null)
            {
                ErrorMessage = "جزئیات سفارش پیدا نشد.";
            }
            else
            {
                IsDetailPageVisible = true;
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

    private void BackToReport()
    {
        IsDetailPageVisible = false;
    }

    private void ClearFilters()
    {
        SelectedDate = DateTime.Today;
        SelectedStatusFilter = StatusFilters[0];
        SelectedDeliveryMethod = DeliveryMethods[0];
        SelectedPaymentMethod = PaymentMethods[0];
        SelectedFood = Foods.Count > 0 ? Foods[0] : new SelectOption<string?>(null, "همه غذاها");
        OrderNumberSearch = null;
        CustomerNameSearch = null;
        PhoneNumberSearch = null;
        ErrorMessage = null;
        SuccessMessage = null;
    }

    private async Task LoadFoodsAsync()
    {
        if (_foodsLoaded)
        {
            return;
        }

        try
        {
            var foods = await _foodsApiClient.GetFoodsAsync();
            Foods.Clear();
            Foods.Add(new SelectOption<string?>(null, "همه غذاها"));
            foreach (var food in foods
                         .OrderBy(food => food.Name))
            {
                Foods.Add(new SelectOption<string?>(food.Name, food.Name));
            }

            SelectedFood = Foods[0];
            _foodsLoaded = true;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            ErrorMessage = $"دریافت لیست غذاها ناموفق بود: {exception.Message}";
        }
    }
}
