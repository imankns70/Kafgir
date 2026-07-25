using Kafgir.Application.Interfaces;
using Kafgir.Contracts.Menus;
using Kafgir.Domain.Entities;

namespace Kafgir.Application.Services;

public sealed class DailyMenuService(
    IDailyMenuRepository dailyMenuRepository,
    IFoodRepository foodRepository,
    IUnitOfWork unitOfWork) : IDailyMenuService
{
    public async Task<DailyMenuDto?> GetByDateAsync(
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var menu = await dailyMenuRepository.GetByDateAsync(date, cancellationToken);
        return menu is null ? null : Map(menu);
    }

    public async Task<DailyMenuDto> CreateOrUpdateAsync(
        CreateOrUpdateDailyMenuRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(request);

        var menu = await dailyMenuRepository.GetByDateAsync(request.MenuDate, cancellationToken);
        if (menu is null)
        {
            menu = new DailyMenu
            {
                MenuDate = request.MenuDate,
                IsOpen = request.IsOpen,
                Note = request.Note,
                CreatedAt = DateTime.UtcNow
            };
            await dailyMenuRepository.AddAsync(menu, cancellationToken);
        }
        else
        {
            if (menu.Items.Count > 0 && request.Items.Count == 0)
            {
                throw new ArgumentException(
                    "Daily menu items cannot be cleared by an empty save. Remove items individually or disable them.");
            }

            menu.IsOpen = request.IsOpen;
            menu.Note = request.Note;
        }

        var retainedItems = new HashSet<DailyMenuItem>();

        foreach (var itemRequest in request.Items)
        {
            var food = await foodRepository.GetByIdAsync(itemRequest.FoodId, cancellationToken)
                ?? throw new ArgumentException($"Food with id {itemRequest.FoodId} was not found.");

            var existingItem = FindExistingItem(menu, itemRequest);
            if (existingItem is null)
            {
                menu.Items.Add(new DailyMenuItem
                {
                    FoodId = itemRequest.FoodId,
                    Food = food,
                    Price = itemRequest.Price,
                    CapacityPortions = itemRequest.CapacityPortions,
                    IsAvailable = itemRequest.IsAvailable,
                    CreatedAt = DateTime.UtcNow
                });
                retainedItems.Add(menu.Items.Single(item => item.FoodId == itemRequest.FoodId));
                continue;
            }

            if (existingItem.FoodId != itemRequest.FoodId)
            {
                throw new ArgumentException("An existing daily menu item's food cannot be changed.");
            }

            if (itemRequest.CapacityPortions < existingItem.SoldPortions)
            {
                throw new ArgumentException(
                    $"Capacity for food id {itemRequest.FoodId} cannot be less than its sold portions.");
            }

            existingItem.Price = itemRequest.Price;
            existingItem.CapacityPortions = itemRequest.CapacityPortions;
            existingItem.IsAvailable = itemRequest.IsAvailable;
            retainedItems.Add(existingItem);
        }

        var removedItems = menu.Items
            .Where(item => !retainedItems.Contains(item))
            .ToList();

        foreach (var removedItem in removedItems)
        {
            if (removedItem.SoldPortions > 0)
            {
                throw new ArgumentException(
                    $"Daily menu item for food id {removedItem.FoodId} cannot be removed because it has sold portions.");
            }

            menu.Items.Remove(removedItem);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(menu);
    }

    public async Task<DailyMenuDto> UpdateSettingsAsync(
        DateOnly date,
        UpdateDailyMenuSettingsRequest request,
        CancellationToken cancellationToken = default)
    {
        if (date == default)
        {
            throw new ArgumentException("Menu date is required.");
        }

        var menu = await dailyMenuRepository.GetByDateAsync(date, cancellationToken);
        if (menu is null)
        {
            menu = new DailyMenu
            {
                MenuDate = date,
                IsOpen = request.IsOpen,
                Note = request.Note,
                CreatedAt = DateTime.UtcNow
            };
            await dailyMenuRepository.AddAsync(menu, cancellationToken);
        }
        else
        {
            menu.IsOpen = request.IsOpen;
            menu.Note = request.Note;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(menu);
    }

    public async Task<bool> SetItemAvailabilityAsync(
        int dailyMenuItemId,
        bool isAvailable,
        CancellationToken cancellationToken = default)
    {
        var item = await dailyMenuRepository.GetItemByIdAsync(dailyMenuItemId, cancellationToken);
        if (item is null)
        {
            return false;
        }

        item.IsAvailable = isAvailable;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<DailyMenuDto?> RemoveItemAsync(
        int dailyMenuItemId,
        CancellationToken cancellationToken = default)
    {
        var item = await dailyMenuRepository.GetItemByIdAsync(dailyMenuItemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        if (item.SoldPortions > 0 || await dailyMenuRepository.IsItemBookedAsync(dailyMenuItemId, cancellationToken))
        {
            throw new ArgumentException(
                $"Daily menu item for food id {item.FoodId} cannot be removed because it is used by customer orders.");
        }

        var menu = await dailyMenuRepository.GetByDateAsync(item.DailyMenu.MenuDate, cancellationToken);
        if (menu is null)
        {
            return null;
        }

        var itemToRemove = menu.Items.SingleOrDefault(menuItem => menuItem.Id == dailyMenuItemId);
        if (itemToRemove is null)
        {
            return null;
        }

        menu.Items.Remove(itemToRemove);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(menu);
    }

    public async Task<DailyMenuDto?> UpdateItemAsync(
        int dailyMenuItemId,
        UpdateDailyMenuItemRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.Price < 0)
        {
            throw new ArgumentException("Price cannot be negative.");
        }

        if (request.CapacityPortions < 0)
        {
            throw new ArgumentException("Capacity cannot be negative.");
        }

        var item = await dailyMenuRepository.GetItemByIdAsync(dailyMenuItemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        if (request.CapacityPortions < item.SoldPortions)
        {
            throw new ArgumentException("Capacity cannot be less than sold portions.");
        }

        item.Price = request.Price;
        item.CapacityPortions = request.CapacityPortions;
        item.IsAvailable = request.IsAvailable;

        await unitOfWork.SaveChangesAsync(cancellationToken);

        var menu = await dailyMenuRepository.GetByDateAsync(item.DailyMenu.MenuDate, cancellationToken);
        return menu is null ? null : Map(menu);
    }

    public async Task<DailyMenuDto> AddItemAsync(
        DateOnly date,
        UpsertDailyMenuItemRequest request,
        CancellationToken cancellationToken = default)
    {
        if (date == default)
        {
            throw new ArgumentException("Menu date is required.");
        }

        ValidateItemRequest(request);

        var food = await foodRepository.GetByIdAsync(request.FoodId, cancellationToken)
            ?? throw new ArgumentException($"Food with id {request.FoodId} was not found.");

        var menu = await dailyMenuRepository.GetByDateAsync(date, cancellationToken);
        if (menu is null)
        {
            menu = new DailyMenu
            {
                MenuDate = date,
                CreatedAt = DateTime.UtcNow
            };
            await dailyMenuRepository.AddAsync(menu, cancellationToken);
        }
        else if (menu.Items.Any(item => item.FoodId == request.FoodId))
        {
            throw new ArgumentException($"Food id {request.FoodId} already exists in this daily menu.");
        }

        menu.Items.Add(new DailyMenuItem
        {
            FoodId = request.FoodId,
            Food = food,
            Price = request.Price,
            CapacityPortions = request.CapacityPortions,
            IsAvailable = request.IsAvailable,
            CreatedAt = DateTime.UtcNow
        });

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(menu);
    }

    private static DailyMenuItem? FindExistingItem(
        DailyMenu menu,
        UpsertDailyMenuItemRequest request)
    {
        if (request.Id.HasValue)
        {
            return menu.Items.SingleOrDefault(item => item.Id == request.Id.Value)
                ?? throw new ArgumentException(
                    $"Daily menu item with id {request.Id.Value} does not belong to this menu.");
        }

        return menu.Items.SingleOrDefault(item => item.FoodId == request.FoodId);
    }

    private static void ValidateRequest(CreateOrUpdateDailyMenuRequest request)
    {
        if (request.MenuDate == default)
        {
            throw new ArgumentException("Menu date is required.");
        }

        if (request.Items is null)
        {
            throw new ArgumentException("Menu items cannot be null.");
        }

        var duplicateFoodId = request.Items
            .GroupBy(item => item.FoodId)
            .FirstOrDefault(group => group.Count() > 1)?.Key;

        if (duplicateFoodId.HasValue)
        {
            throw new ArgumentException($"Food id {duplicateFoodId.Value} appears more than once.");
        }

        foreach (var item in request.Items)
        {
            ValidateItemRequest(item);
        }
    }

    private static void ValidateItemRequest(UpsertDailyMenuItemRequest item)
    {
        if (item.FoodId <= 0)
        {
            throw new ArgumentException("Food id must be greater than zero.");
        }

        if (item.Price < 0)
        {
            throw new ArgumentException($"Price for food id {item.FoodId} cannot be negative.");
        }

        if (item.CapacityPortions < 0)
        {
            throw new ArgumentException($"Capacity for food id {item.FoodId} cannot be negative.");
        }
    }

    private static DailyMenuDto Map(DailyMenu menu) => new()
    {
        Id = menu.Id,
        MenuDate = menu.MenuDate,
        IsOpen = menu.IsOpen,
        Note = menu.Note,
        Items = menu.Items
            .OrderBy(item => item.Id)
            .Select(item => new DailyMenuItemDto
            {
                Id = item.Id,
                FoodId = item.FoodId,
                FoodName = item.Food.Name,
                FoodDescription = item.Food.Description,
                ImageUrl = item.Food.ImageUrl,
                Price = item.Price,
                CapacityPortions = item.CapacityPortions,
                SoldPortions = item.SoldPortions,
                RemainingPortions = item.RemainingPortions,
                IsAvailable = item.IsAvailable
            })
            .ToList()
    };
}
