package setting

// Waffo Pancake hosted checkout configuration. Gateway is enabled once
// MerchantID + PrivateKey + ProductID are populated (no separate Enabled
// flag, matching Stripe / Creem). StoreID + ProductID are operator-bound
// via SaveWaffoPancakeConfig.
var (
	WaffoPancakeMerchantID string
	WaffoPancakePrivateKey string
	WaffoPancakeReturnURL  string
	WaffoPancakeUnitPrice  float64 = 1.0
	WaffoPancakeMinTopUp   int     = 1
	WaffoPancakeStoreID    string
	WaffoPancakeProductID  string
	// WaffoPancakeCurrency is the ISO 4217 currency code that the Pancake
	// store charges in (e.g. "USD", "EUR"). Defaults to "USD". The frontend
	// uses this to label the payment amount shown to the user.
	WaffoPancakeCurrency string = "USD"
)
