import os

def replace_in_file(file_path, replacements):
    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content
    for target, replacement in replacements.items():
        content = content.replace(target, replacement)

    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[UPDATED] {file_path}")
    else:
        # print(f"[NO CHANGES] {file_path}")
        pass

def main():
    print("Renaming imports and hooks in copied Quotes files...")
    
    # List of files to process
    target_files = [
        # Components
        "src/components/AdminViewToggle.tsx",
        "src/components/AnalyticsPanel.tsx",
        "src/components/AuditLogsPanel.tsx",
        "src/components/BranchSelector.tsx",
        "src/components/CategoryCheckboxList.tsx",
        "src/components/CategorySelector.tsx",
        "src/components/CopyHelperPanel.tsx",
        "src/components/DailyEntryForm.tsx",
        "src/components/IPCheckerModal.tsx",
        "src/components/LoginCodesModal.tsx",
        "src/components/QuoteRulesPanel.tsx",
        "src/components/RecordsTable.tsx",
        "src/components/SaveFileHelperPanel.tsx",
        "src/components/SearchFilters.tsx",
        "src/components/StatsGrid.tsx",
        "src/components/ToastProvider.tsx",
        "src/components/TodoPanel.tsx",
        "src/components/QuotesUserManagementPanel.tsx",
        "src/components/VerifiedBadge.tsx",
        "src/components/QuotesNavbar.tsx",
        "src/components/QuotesAppUpdater.tsx",
        "src/components/QuotesSkeletonLoader.tsx",
        
        # Modals
        "src/components/modals/AddUserModal.tsx",
        "src/components/modals/ConfirmModal.tsx",
        "src/components/modals/CustomEntryModal.tsx",
        "src/components/modals/EditProfileModal.tsx",
        "src/components/modals/EditRecordModal.tsx",
        "src/components/modals/SaleStatusModal.tsx",
        
        # Pages
        "src/app/quotes/page.tsx",
        
        # Hooks
        "src/hooks/useAdminActions.ts",
        "src/hooks/useCopyHelper.ts",
        "src/hooks/useRecordActions.ts",
        "src/hooks/useSaveFileHelper.ts",
        "src/hooks/useQuotesDashboardData.ts",
        "src/hooks/useQuotesTheme.ts",
        
        # Utils
        "src/utils/downloadHelper.ts",
        "src/utils/initialRulesData.ts",
        "src/utils/leaderboardHelper.ts",
        "src/utils/quotesOfflineSync.ts",
        "src/utils/quotesValidator.ts",
        "src/utils/quotesDashboardHelpers.ts"
    ]

    replacements = {
        # Hook path and hook name replacements
        "'@/hooks/useDashboardData'": "'@/hooks/useQuotesDashboardData'",
        '"@/hooks/useDashboardData"': '"@/hooks/useQuotesDashboardData"',
        "useDashboardData": "useQuotesDashboardData",
        
        # Theme hook path and theme hook name replacements
        "'@/hooks/useTheme'": "'@/hooks/useQuotesTheme'",
        '"@/hooks/useTheme"': '"@/hooks/useQuotesTheme"',
        "useTheme": "useQuotesTheme",
        
        # OfflineSync util path replacements
        "'@/utils/offlineSync'": "'@/utils/quotesOfflineSync'",
        '"@/utils/offlineSync"': '"@/utils/quotesOfflineSync"',
        
        # Validator util path replacements
        "'@/utils/validator'": "'@/utils/quotesValidator'",
        '"@/utils/validator"': '"@/utils/quotesValidator"',
        
        # DashboardHelpers util path replacements
        "'@/utils/dashboardHelpers'": "'@/utils/quotesDashboardHelpers'",
        '"@/utils/dashboardHelpers"': '"@/utils/quotesDashboardHelpers"',
        
        # Navbar component path replacements
        "'@/components/Navbar'": "'@/components/QuotesNavbar'",
        '"@/components/Navbar"': '"@/components/QuotesNavbar"',
        
        # AppUpdater component path replacements
        "'@/components/AppUpdater'": "'@/components/QuotesAppUpdater'",
        '"@/components/AppUpdater"': '"@/components/QuotesAppUpdater"',
        
        # SkeletonLoader component path replacements
        "'@/components/SkeletonLoader'": "'@/components/QuotesSkeletonLoader'",
        '"@/components/SkeletonLoader"': '"@/components/QuotesSkeletonLoader"',
        
        # UserManagementPanel component path replacements
        "'@/components/UserManagementPanel'": "'@/components/QuotesUserManagementPanel'",
        '"@/components/UserManagementPanel"': '"@/components/QuotesUserManagementPanel"',
    }

    base_path = "/Users/bnfcorporate/Documents/Web Dev/qc-manager"
    for file_rel in target_files:
        file_path = os.path.join(base_path, file_rel)
        replace_in_file(file_path, replacements)

    print("Import renames completed successfully!")

if __name__ == "__main__":
    main()
