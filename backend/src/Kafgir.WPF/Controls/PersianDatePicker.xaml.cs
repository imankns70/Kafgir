using System.Globalization;
using System.Windows;
using System.Windows.Controls;

namespace Kafgir.WPF.Controls;

public partial class PersianDatePicker : UserControl
{
    public static readonly DependencyProperty SelectedDateProperty =
        DependencyProperty.Register(
            nameof(SelectedDate),
            typeof(DateTime),
            typeof(PersianDatePicker),
            new FrameworkPropertyMetadata(
                DateTime.Today,
                FrameworkPropertyMetadataOptions.BindsTwoWayByDefault,
                OnSelectedDateChanged));

    private static readonly string[] MonthNames =
    [
        "فروردین",
        "اردیبهشت",
        "خرداد",
        "تیر",
        "مرداد",
        "شهریور",
        "مهر",
        "آبان",
        "آذر",
        "دی",
        "بهمن",
        "اسفند"
    ];

    private readonly PersianCalendar _calendar = new();
    private bool _isUpdating;

    public PersianDatePicker()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    public DateTime SelectedDate
    {
        get => (DateTime)GetValue(SelectedDateProperty);
        set => SetValue(SelectedDateProperty, value.Date);
    }

    private static void OnSelectedDateChanged(
        DependencyObject dependencyObject,
        DependencyPropertyChangedEventArgs args)
    {
        if (dependencyObject is PersianDatePicker picker && args.NewValue is DateTime)
        {
            picker.SyncFromSelectedDate();
        }
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        SyncFromSelectedDate();
    }

    private void SyncFromSelectedDate()
    {
        if (!IsLoaded)
        {
            return;
        }

        _isUpdating = true;
        try
        {
            var selected = SelectedDate == default ? DateTime.Today : SelectedDate.Date;
            var year = _calendar.GetYear(selected);
            var month = _calendar.GetMonth(selected);
            var day = _calendar.GetDayOfMonth(selected);

            YearBox.ItemsSource = BuildYearOptions(year);
            MonthBox.ItemsSource = BuildMonthOptions();
            YearBox.SelectedValue = year;
            MonthBox.SelectedValue = month;
            RefreshDayOptions(year, month, day);
        }
        finally
        {
            _isUpdating = false;
        }
    }

    private void DatePart_OnSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (_isUpdating || !IsLoaded)
        {
            return;
        }

        if (YearBox.SelectedValue is not int year || MonthBox.SelectedValue is not int month)
        {
            return;
        }

        var currentDay = DayBox.SelectedValue is int day ? day : 1;
        var daysInMonth = _calendar.GetDaysInMonth(year, month);
        var safeDay = Math.Min(currentDay, daysInMonth);

        RefreshDayOptions(year, month, safeDay);
        SelectedDate = _calendar.ToDateTime(year, month, safeDay, 0, 0, 0, 0);
    }

    private void RefreshDayOptions(int year, int month, int selectedDay)
    {
        var daysInMonth = _calendar.GetDaysInMonth(year, month);
        DayBox.ItemsSource = Enumerable
            .Range(1, daysInMonth)
            .Select(day => new PersianDatePart(day, day.ToString("00", CultureInfo.InvariantCulture)))
            .ToList();
        DayBox.SelectedValue = Math.Clamp(selectedDay, 1, daysInMonth);
    }

    private IReadOnlyList<PersianDatePart> BuildYearOptions(int selectedYear)
    {
        var currentYear = _calendar.GetYear(DateTime.Today);
        var startYear = Math.Min(1390, selectedYear - 10);
        var endYear = Math.Max(currentYear + 10, selectedYear + 10);

        return Enumerable
            .Range(startYear, endYear - startYear + 1)
            .Select(year => new PersianDatePart(year, year.ToString(CultureInfo.InvariantCulture)))
            .ToList();
    }

    private static IReadOnlyList<PersianDatePart> BuildMonthOptions() =>
        MonthNames
            .Select((monthName, index) => new PersianDatePart(index + 1, monthName))
            .ToList();

    private sealed record PersianDatePart(int Value, string Display)
    {
        public override string ToString() => Display;
    }
}
