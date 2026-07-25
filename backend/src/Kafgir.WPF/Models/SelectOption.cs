namespace Kafgir.WPF.Models;

public sealed record SelectOption<TValue>(TValue Value, string DisplayName)
{
    public override string ToString() => DisplayName;
}
