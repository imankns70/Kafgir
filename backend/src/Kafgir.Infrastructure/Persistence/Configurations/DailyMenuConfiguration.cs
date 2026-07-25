using Kafgir.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kafgir.Infrastructure.Persistence.Configurations;

public sealed class DailyMenuConfiguration : IEntityTypeConfiguration<DailyMenu>
{
    public void Configure(EntityTypeBuilder<DailyMenu> builder)
    {
        builder.Property(x => x.MenuDate).HasColumnType("date");
        builder.Property(x => x.IsOpen).HasDefaultValue(false);
        builder.Property(x => x.Note).HasMaxLength(1000);
        builder.HasIndex(x => x.MenuDate).IsUnique();

        builder.HasMany(x => x.Items)
            .WithOne(x => x.DailyMenu)
            .HasForeignKey(x => x.DailyMenuId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
