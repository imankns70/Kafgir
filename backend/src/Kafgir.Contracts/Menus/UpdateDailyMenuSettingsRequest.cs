namespace Kafgir.Contracts.Menus;

public sealed class UpdateDailyMenuSettingsRequest
{
    public bool IsOpen { get; set; }
    public string? Note { get; set; }
}
