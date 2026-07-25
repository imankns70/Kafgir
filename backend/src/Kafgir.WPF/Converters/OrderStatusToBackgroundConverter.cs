using System.Globalization;
using System.Windows;
using System.Windows.Data;
using Kafgir.Contracts.Orders;

namespace Kafgir.WPF.Converters;

public sealed class OrderStatusToBackgroundConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var key = value switch
        {
            OrderStatus.PendingConfirmation => "WarningSoftBrush",
            OrderStatus.Confirmed => "BrandPrimarySoftBrush",
            OrderStatus.Preparing => "BrandAccentSoftBrush",
            OrderStatus.Ready => "InfoSoftBrush",
            OrderStatus.Delivered => "SuccessSoftBrush",
            OrderStatus.Cancelled => "ErrorSoftBrush",
            _ => "BackgroundSecondaryBrush"
        };

        return Application.Current.TryFindResource(key) ?? DependencyProperty.UnsetValue;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
