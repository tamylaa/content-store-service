# PowerShell script to diagnose Cloudflare Wrangler production deployment issues

# Check Wrangler CLI installation
Write-Host "Checking Wrangler CLI installation..."
$wranglerVersion = npx wrangler --version 2>$null
if (-not $wranglerVersion) {
    Write-Host "Wrangler CLI is not installed or not in PATH."
    exit 1
} else {
    Write-Host "Wrangler version: $wranglerVersion"
}

# Check for required secrets (AUTH_JWT_SECRET)
Write-Host "Checking for required Cloudflare secrets..."
$secrets = npx wrangler secret list --env production 2>$null
if ($secrets -and $secrets -match "AUTH_JWT_SECRET") {
    Write-Host "AUTH_JWT_SECRET is set."
} else {
    Write-Host "AUTH_JWT_SECRET is NOT set for production!"
}

# List R2 buckets and check for required ones
Write-Host "Listing R2 buckets..."
$r2Buckets = npx wrangler r2 bucket list 2>$null
if ($r2Buckets) {
    if ($r2Buckets -match "tamyla-content-store") {
        Write-Host "R2 bucket 'tamyla-content-store' exists."
    } else {
        Write-Host "R2 bucket 'tamyla-content-store' is missing!"
    }
    if ($r2Buckets -match "tamyla-content-store-staging") {
        Write-Host "R2 bucket 'tamyla-content-store-staging' exists."
    } else {
        Write-Host "R2 bucket 'tamyla-content-store-staging' is missing!"
    }
} else {
    Write-Host "Could not list R2 buckets. Check Wrangler authentication."
}

# List analytics datasets and check for required one
Write-Host "Listing Analytics Engine datasets..."
$analyticsDatasets = npx wrangler analytics-engine dataset list 2>$null
if ($analyticsDatasets -match "CONTENT_ANALYTICS") {
    Write-Host "Analytics dataset 'CONTENT_ANALYTICS' exists."
} else {
    Write-Host "Analytics dataset 'CONTENT_ANALYTICS' is missing!"
}

# Validate wrangler.toml syntax
Write-Host "Validating wrangler.toml syntax..."
$validateResult = npx wrangler validate 2>&1
if ($validateResult -match "success" -or $validateResult -match "valid") {
    Write-Host "wrangler.toml syntax is valid."
} else {
    Write-Host "wrangler.toml syntax may be invalid. Output:"
    Write-Host $validateResult
}

Write-Host "Diagnostics complete. Review any warnings above."
