# Technical Specification: Filter Chips UI (Porting to PWA)

This document provides the implementation details of the "Filter Chips" feature from the Android Native/Headless UI, designed to be ported to the SVR PWA.

## 1. Feature Overview
A horizontal scrollable bar located in the header that displays active search filters as "chips". Each chip can be removed individually via a close icon.

## 2. HTML Structure
The container should be placed inside the main header, below the search bar.

```html
<!-- Main Header -->
<header class="svr-header">
    <div class="svr-top-row">
        <!-- Search Input Container -->
        <div class="search-container">
            <i class="fas fa-search" id="searchIcon"></i>
            <input type="text" id="searchInput" placeholder="Zoek een SVR camping">
            <span id="infoBtn">i</span>
        </div>
    </div>
    
    <!-- Filter Chips Bar -->
    <div id="active-filters-bar" class="active-filters-bar"></div>
</header>
```

## 3. CSS Styling (Vanilla CSS)

```css
:root {
    --svr-yellow: #FDCC01;
    --svr-blue: #008AD3;
    --svr-red: #c0392b;
    --status-bar-height: 36px; /* Adjust for PWA if needed */
}

/* Header state adjustments */
.svr-header {
    position: fixed; top: 0; left: 0; width: 100%; height: 100px;
    background-color: var(--svr-yellow); z-index: 1000;
    display: flex; flex-direction: column; padding-top: var(--status-bar-height);
    transition: height 0.3s ease;
    justify-content: center;
}

/* Expanded state when filters are active */
.svr-header.has-filters { 
    height: 136px; /* Increased to accommodate the chips bar */
    justify-content: flex-start; 
}

/* The scrollable bar */
.active-filters-bar { 
    width: 100%; 
    height: 40px; 
    overflow-x: auto; 
    white-space: nowrap; 
    padding: 4px 12px; 
    margin-bottom: 4px; 
    box-sizing: border-box; 
    display: none; /* Hidden by default */
    scrollbar-width: none; /* Firefox */
}

.active-filters-bar::-webkit-scrollbar { 
    display: none; /* Chrome/Safari */
}

.svr-header.has-filters .active-filters-bar { 
    display: flex; 
    align-items: center; 
}

/* Individual Chip Styling */
.active-filter-chip { 
    display: inline-flex; 
    align-items: center; 
    background: white; 
    padding: 0 10px; 
    border-radius: 15px; 
    margin-right: 8px; 
    font-size: 11px; 
    font-weight: bold; 
    color: var(--svr-blue); 
    border: 1px solid rgba(0,0,0,0.1); 
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    height: 28px; 
    line-height: 28px; 
    box-sizing: border-box; 
    flex-shrink: 0;
}

/* Close Icon in Chip */
.active-filter-chip i { 
    margin-left: 8px; 
    cursor: pointer; 
    color: var(--svr-red); 
    font-size: 14px; 
}
```

## 4. JavaScript Logic

### Rendering Logic
This function should be called whenever the filter state changes.

```javascript
/**
 * Updates the Header Chips UI based on selected filters.
 * @param {Array} selectedItems - Array of objects { guid: string, name: string }
 */
function updateActiveFiltersUI(selectedItems) {
    const headerBar = document.getElementById('active-filters-bar');
    const svrHeader = document.querySelector('.svr-header');
    
    if (!headerBar) return;
    
    // Clear current chips
    headerBar.innerHTML = '';

    if (selectedItems.length > 0) {
        svrHeader.classList.add('has-filters');

        selectedItems.forEach(item => {
            const chip = document.createElement('div');
            chip.className = 'active-filter-chip';
            chip.innerHTML = `${item.name}<i class="fas fa-times-circle" data-guid="${item.guid}"></i>`;
            headerBar.appendChild(chip);

            // Click event to remove this specific filter
            chip.querySelector('i').onclick = (e) => {
                e.stopPropagation();
                const guid = e.target.getAttribute('data-guid');
                removeFilterByGuid(guid);
            };
        });
    } else {
        svrHeader.classList.remove('has-filters');
    }
}
```

### Removal & Reset Logic

```javascript
/**
 * Removes a single filter and triggers search refresh.
 */
function removeFilterByGuid(guid) {
    // 1. Update your global state (e.g., window.currentFilters)
    if (window.currentFilters) {
        window.currentFilters = window.currentFilters.filter(f => f !== guid);
    }
    
    // 2. Sync your UI (uncheck checkboxes in the filter menu)
    syncFilterCheckboxes();
    
    // 3. Trigger search/apply
    applyFiltersAndRefresh();
}

/**
 * Resets all filters.
 */
function resetAllFilters() {
    window.currentFilters = [];
    
    // Uncheck all UI elements
    document.querySelectorAll('.filter-checkbox').forEach(cb => cb.checked = false);
    
    // Update Header
    updateActiveFiltersUI([]);
    
    // Trigger refresh
    applyFiltersAndRefresh();
}
```

## 5. Key Considerations for PWA
- **Icons**: The implementation uses FontAwesome (`fas fa-times-circle`). Ensure FontAwesome is loaded in the PWA.
- **State Management**: Ensure `window.currentFilters` (or your PWA equivalent) is the single source of truth.
- **Mobile UX**: The horizontal scroll on the chips bar should feel native. The CSS `overflow-x: auto` with `scrollbar-width: none` handles this.
- **Dynamic Resizing**: The header height transition (`0.3s ease`) ensures a smooth shift when filters appear/disappear.
