namespace Kafgir.Contracts.Menus;

public sealed class CreateOrUpdateDailyMenuRequest
{
    public DateOnly MenuDate { get; set; }
    public bool IsOpen { get; set; }
    public string? Note { get; set; }
    public List<UpsertDailyMenuItemRequest> Items { get; set; } = new();
}
