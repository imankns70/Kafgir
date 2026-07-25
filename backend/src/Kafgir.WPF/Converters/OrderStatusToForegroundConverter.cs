using System.Globalization;
using System.Windows;
using System.Windows.Data;
using Kafgir.Contracts.Orders;

namespace Kafgir.WPF.Converters;

public sealed class OrderStatusToForegroundConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var key = value switch
        {
            OrderStatus.PendingConfirmation => "WarningBrush",
            OrderStatus.Confirmed => "BrandPrimaryBrush",
            OrderStatus.Preparing => "WarningBrush",
            OrderStatus.Ready => "InfoBrush",
            OrderStatus.Delivered => "SuccessBrush",
            OrderStatus.Cancelled => "ErrorBrush",
            _ => "TextSecondaryBrush"
        };

        return Application.Current.TryFindResource(key) ?? DependencyProperty.UnsetValue;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
