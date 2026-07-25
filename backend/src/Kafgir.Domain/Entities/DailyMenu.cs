namespace Kafgir.Domain.Entities;

public sealed class DailyMenu
{
    public int Id { get; init; }
    public DateOnly MenuDate { get; set; }
    public bool IsOpen { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; init; }

    public ICollection<DailyMenuItem> Items { get; init; } = new List<DailyMenuItem>();
}
