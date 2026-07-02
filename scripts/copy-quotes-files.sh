#!/bin/bash

SRC_DIR="/Users/bnfcorporate/Documents/Web Dev/quotes-sales-tracker/src"
DEST_DIR="/Users/bnfcorporate/Documents/Web Dev/qc-manager/src"

echo "Copying Quotes components..."
cp "${SRC_DIR}/components/AdminViewToggle.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/AnalyticsPanel.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/AuditLogsPanel.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/BranchSelector.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/CategoryCheckboxList.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/CategorySelector.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/CopyHelperPanel.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/DailyEntryForm.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/IPCheckerModal.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/LoginCodesModal.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/QuoteRulesPanel.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/RecordsTable.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/SaveFileHelperPanel.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/SearchFilters.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/StatsGrid.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/ToastProvider.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/TodoPanel.tsx" "${DEST_DIR}/components/"
cp "${SRC_DIR}/components/UserManagementPanel.tsx" "${DEST_DIR}/components/QuotesUserManagementPanel.tsx"
cp "${SRC_DIR}/components/VerifiedBadge.tsx" "${DEST_DIR}/components/"

# Conflicting names -> renamed to Quotes prefix
cp "${SRC_DIR}/components/Navbar.tsx" "${DEST_DIR}/components/QuotesNavbar.tsx"
cp "${SRC_DIR}/components/AppUpdater.tsx" "${DEST_DIR}/components/QuotesAppUpdater.tsx"
cp "${SRC_DIR}/components/SkeletonLoader.tsx" "${DEST_DIR}/components/QuotesSkeletonLoader.tsx"

# Modals
mkdir -p "${DEST_DIR}/components/modals"
cp "${SRC_DIR}/components/modals/"* "${DEST_DIR}/components/modals/"

echo "Copying Quotes hooks..."
cp "${SRC_DIR}/hooks/useAdminActions.ts" "${DEST_DIR}/hooks/"
cp "${SRC_DIR}/hooks/useCopyHelper.ts" "${DEST_DIR}/hooks/"
cp "${SRC_DIR}/hooks/useRecordActions.ts" "${DEST_DIR}/hooks/"
cp "${SRC_DIR}/hooks/useSaveFileHelper.ts" "${DEST_DIR}/hooks/"

# Conflicting hooks
cp "${SRC_DIR}/hooks/useDashboardData.ts" "${DEST_DIR}/hooks/useQuotesDashboardData.ts"
cp "${SRC_DIR}/hooks/useTheme.ts" "${DEST_DIR}/hooks/useQuotesTheme.ts"

echo "Copying Quotes utils..."
cp "${SRC_DIR}/utils/downloadHelper.ts" "${DEST_DIR}/utils/"
cp "${SRC_DIR}/utils/initialRulesData.ts" "${DEST_DIR}/utils/"
cp "${SRC_DIR}/utils/leaderboardHelper.ts" "${DEST_DIR}/utils/"

# Conflicting utils
cp "${SRC_DIR}/utils/offlineSync.ts" "${DEST_DIR}/utils/quotesOfflineSync.ts"
cp "${SRC_DIR}/utils/validator.ts" "${DEST_DIR}/utils/quotesValidator.ts"
cp "${SRC_DIR}/utils/dashboardHelpers.ts" "${DEST_DIR}/utils/quotesDashboardHelpers.ts"

echo "Quotes files copied successfully!"
