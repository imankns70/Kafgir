using System.Globalization;
using System.Windows.Data;

namespace Kafgir.WPF.Converters;

public sealed class PersianMoneyWordsConverter : IValueConverter
{
    private static readonly string[] Ones =
    [
        "",
        "یک",
        "دو",
        "سه",
        "چهار",
        "پنج",
        "شش",
        "هفت",
        "هشت",
        "نه",
        "ده",
        "یازده",
        "دوازده",
        "سیزده",
        "چهارده",
        "پانزده",
        "شانزده",
        "هفده",
        "هجده",
        "نوزده"
    ];

    private static readonly string[] Tens =
    [
        "",
        "",
        "بیست",
        "سی",
        "چهل",
        "پنجاه",
        "شصت",
        "هفتاد",
        "هشتاد",
        "نود"
    ];

    private static readonly string[] Hundreds =
    [
        "",
        "صد",
        "دویست",
        "سیصد",
        "چهارصد",
        "پانصد",
        "ششصد",
        "هفتصد",
        "هشتصد",
        "نهصد"
    ];

    private static readonly string[] Scales =
    [
        "",
        "هزار",
        "میلیون",
        "میلیارد",
        "تریلیون"
    ];

    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var amount = value switch
        {
            decimal decimalValue => decimalValue,
            int intValue => intValue,
            long longValue => longValue,
            null => 0m,
            _ when decimal.TryParse(value.ToString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => 0m
        };

        var roundedAmount = (long)Math.Round(amount, MidpointRounding.AwayFromZero);
        if (roundedAmount <= 0)
        {
            return "صفر تومان";
        }

        return $"{ToPersianWords(roundedAmount)} تومان";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        Binding.DoNothing;

    private static string ToPersianWords(long value)
    {
        var parts = new List<string>();
        var scaleIndex = 0;

        while (value > 0 && scaleIndex < Scales.Length)
        {
            var group = (int)(value % 1000);
            if (group > 0)
            {
                var groupText = ConvertBelowThousand(group);
                var scale = Scales[scaleIndex];
                parts.Insert(0, string.IsNullOrWhiteSpace(scale) ? groupText : $"{groupText} {scale}");
            }

            value /= 1000;
            scaleIndex++;
        }

        return string.Join(" و ", parts);
    }

    private static string ConvertBelowThousand(int value)
    {
        var parts = new List<string>();

        var hundreds = value / 100;
        var remainder = value % 100;

        if (hundreds > 0)
        {
            parts.Add(Hundreds[hundreds]);
        }

        if (remainder > 0)
        {
            if (remainder < 20)
            {
                parts.Add(Ones[remainder]);
            }
            else
            {
                var tens = remainder / 10;
                var ones = remainder % 10;
                parts.Add(Tens[tens]);
                if (ones > 0)
                {
                    parts.Add(Ones[ones]);
                }
            }
        }

        return string.Join(" و ", parts);
    }
}
