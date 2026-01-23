---
title: Extensions Menu Disabled When Using Market Data
sidebar_position: 7
---

If the **Extensions** menu in Google Sheets appears grayed out (lighter text, unclickable) when trying to use the Market Data add-on, it is almost always due to a Google Sheets behavior when viewing a fully protected sheet — it is **not** caused by the Market Data add-on itself.

**What to look for:** The Extensions menu will be visible but appear lighter in color and won't respond when clicked.

## Why This Happens

- If **every cell** in the current sheet is protected for your account, Google Sheets automatically disables certain menus — including **Extensions** and **Format**.
- This behavior is built into Google Sheets and applies to all add-ons, not just Market Data.
- If the spreadsheet you're using was provided by another person or company and contains fully locked or protected, you may encounter this when viewing those sheets.

## Quick Diagnostic
To confirm this is the issue:
1. Look at the bottom-left corner of Google Sheets
2. If you see "Protected sheet" or similar text, this confirms the sheet is fully protected
3. Try clicking in any cell - if you can't edit any cells, the sheet is fully protected

## How to Fix It

### 1. Switch to a Tab With Editable Cells
1. Click on a sheet tab where you can edit at least one cell.
2. Once you are in an editable sheet, the **Extensions** menu will become active again.

### 2. Ask the Sheet Owner to Add an Editable Cell
If you need to run Market Data from a protected tab:
1. Ask the sheet owner to make a cell on that sheet editable for you.
2. This keeps the menu available without removing important protections.

### 3. Work From Your Own Copy
If you have permission:
1. Go to **File > Make a copy**.
2. Save it to your own Google Drive where you are the owner.
3. You will have full access to all menus (but this removes the original owner’s protections).

## Important Notes
- This issue occurs because of the spreadsheet’s protection settings — not because of the add-on’s installation or your subscription.
- Once you are in a sheet with at least one editable cell, the add-on will be accessible again.

## Still Having Trouble?
If the Extensions menu stays disabled even when on an editable tab:

### Step 1: Refresh and Check
1. Refresh the sheet (**Ctrl+R** or **Cmd+R**)
2. Try switching to a different tab and back
3. Check that you can edit at least one cell on the current tab

### Step 2: Verify Add-on Installation
1. Go to **Extensions > Add-ons > Manage add-ons**
2. Look for "Market Data" in the list
3. Make sure it shows as "Enabled" (not "Disabled" or missing)

### Step 3: Check Permissions
1. Click **Share** in the top-right corner
2. Verify your email has "Editor" access (not just "Viewer")
3. If you only have "Viewer" access, ask the owner to change it to "Editor"

### Step 4: Contact Support
If the problem persists, contact our support team and include:
- The name of the spreadsheet
- Which tab you were on when the menu was disabled
- A screenshot showing the menu state
- Your permission level (Viewer/Editor/Owner)

We typically respond within a few hours during market hours.
