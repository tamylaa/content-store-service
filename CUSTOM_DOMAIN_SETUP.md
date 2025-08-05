# Custom Domain Setup for Content Store Service

## Overview
Setting up `content-store.tamyla.com` as a custom domain for the Cloudflare Workers service.

## Steps

### 1. Add Custom Domain in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your `tamyla.com` domain
3. Navigate to **Workers & Pages** → **content-store-service**
4. Go to **Settings** → **Triggers**
5. Click **Add Custom Domain**
6. Enter: `content-store.tamyla.com`
7. Click **Add Custom Domain**

### 2. DNS Record (Automatic)
Cloudflare will automatically create the necessary DNS record:
```
Type: CNAME
Name: content-store
Target: content-store-service.tamylatrading.workers.dev
```

### 3. SSL Certificate (Automatic)
Cloudflare will automatically provision an SSL certificate for the custom domain.

### 4. Verification
Once setup is complete, verify the service is accessible at:
- **Health Check**: https://content-store.tamyla.com/health
- **API Base**: https://content-store.tamyla.com/api/v1/content

## Benefits

1. **CSP Compliance**: Fits existing `https://*.tamyla.com` policy
2. **Branding**: Clean, professional domain name
3. **SSL**: Automatic SSL certificate management
4. **Performance**: Same Cloudflare edge performance
5. **Reliability**: No dependency on workers.dev domain

## Alternative Manual DNS Setup

If automatic setup doesn't work, manually add:

```
Type: CNAME
Name: content-store
Content: content-store-service.tamylatrading.workers.dev
Proxy Status: Proxied (orange cloud)
TTL: Auto
```

## Testing

After setup, test the endpoints:

```bash
# Health check
curl https://content-store.tamyla.com/health

# Upload (requires auth)
curl -X POST https://content-store.tamyla.com/api/v1/content/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg"

# Library (requires auth)
curl https://content-store.tamyla.com/api/v1/content/library \
  -H "Authorization: Bearer YOUR_TOKEN"
```
