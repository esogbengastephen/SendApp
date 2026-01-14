# ClubKonnect API Endpoints Documentation

This document describes the ClubKonnect API integration endpoints available in the application.

## Overview

The application integrates with ClubKonnect API for utility services (Airtime, Data, TV, Betting). The integration includes:

1. **Purchase Transactions** - Buy utility services
2. **Webhook Callbacks** - Receive async status updates
3. **Query Transactions** - Check transaction status
4. **Cancel Transactions** - Cancel pending orders

---

## 1. Purchase Transaction

**Endpoint:** `POST /api/utility/purchase`

**Description:** Purchase utility services (Airtime, Data, TV, Betting)

**Request Body:**
```json
{
  "serviceId": "airtime",
  "phoneNumber": "08123456789",
  "network": "MTN",
  "packageId": null,
  "amount": 100,
  "userId": "user-uuid",
  "bonusType": "01" // Optional: "01" for MTN Awuf, "02" for MTN Garabasa
}
```

**Response:**
```json
{
  "success": true,
  "message": "Airtime purchase successful!",
  "transaction": {
    "id": "transaction-uuid",
    "reference": "789",
    "amount": 100,
    "total": 102.5
  }
}
```

**Features:**
- Automatically includes `CallBackURL` for webhook notifications
- Generates unique `RequestID` for tracking
- Supports bonus types for MTN airtime
- Handles ORDER_RECEIVED (pending) and ORDER_COMPLETED (success) statuses

---

## 2. Webhook Callback

**Endpoint:** `GET /api/utility/clubkonnect-webhook`

**Description:** Receives status updates from ClubKonnect when transactions are processed

**Query Parameters:**
- `orderid` - ClubKonnect order ID
- `statuscode` - Status code ("100" = pending, "200" = completed)
- `orderstatus` - Order status (ORDER_RECEIVED, ORDER_COMPLETED, etc.)
- `orderremark` - Status message/remark
- `orderdate` - Order date
- `requestid` - Request ID (if provided)

**Example Callback URL:**
```
https://your-domain.com/api/utility/clubkonnect-webhook?orderdate=22th-Jul-2023&orderid=6501321715&statuscode=200&orderstatus=ORDER_COMPLETED&orderremark=You have successfully topped up N100.00...
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook received",
  "orderId": "6501321715",
  "status": "completed"
}
```

**Features:**
- Automatically updates transaction status in database
- Handles both query string and JSON formats
- Updates transaction records when status changes

**Note:** This endpoint is automatically called by ClubKonnect. You don't need to call it manually.

---

## 3. Query Transaction

**Endpoint:** `GET /api/utility/query-transaction`

**Description:** Query the status of a transaction by OrderID or RequestID

**Query Parameters:**
- `orderId` (or `orderid`) - ClubKonnect order ID
- `requestId` (or `requestid`) - Request ID used when creating the transaction

**Example:**
```
GET /api/utility/query-transaction?orderId=789
GET /api/utility/query-transaction?requestId=REQ1234567890
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderid": "6501321715",
    "orderdate": "22th-Jul-2023",
    "requestid": "",
    "statuscode": "200",
    "status": "ORDER_COMPLETED",
    "remark": "You have successfully topped up N100.00 to 2348149659347.",
    "ordertype": "100 Credit",
    "mobilenetwork": "MTN",
    "mobilenumber": "08123456789",
    "amountcharged": "96.5",
    "walletbalance": "3651.449"
  },
  "transactionStatus": "completed"
}
```

**Use Cases:**
- Check status of ORDER_RECEIVED transactions
- Verify transaction completion
- Get transaction details

---

## 4. Cancel Transaction

**Endpoint:** `POST /api/utility/cancel-transaction`

**Description:** Cancel a transaction that has status ORDER_RECEIVED or ORDER_ONHOLD

**Request Body:**
```json
{
  "orderId": "789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction cancelled successfully",
  "data": {
    "orderid": "789",
    "status": "ORDER_CANCELLED"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Cannot cancel transaction with status: completed"
}
```

**Note:** You can only cancel transactions with status:
- `ORDER_RECEIVED` (statuscode "100")
- `ORDER_ONHOLD`

Transactions with status `ORDER_COMPLETED` or `ORDER_FAILED` cannot be cancelled.

---

## Status Codes Reference

| Status Code | Meaning | Transaction Status |
|-------------|---------|-------------------|
| 100 | ORDER_RECEIVED | `pending` - Order received, processing |
| 200 | ORDER_COMPLETED | `completed` - Order completed successfully |
| Other | Error/Failed | `failed` - Transaction failed |

---

## Bonus Types (Airtime Only)

For MTN airtime purchases, you can specify bonus types:

### MTN Awuf (400% bonus)
```json
{
  "serviceId": "airtime",
  "network": "MTN",
  "amount": 100,
  "bonusType": "01"
}
```

### MTN Garabasa (1,000% bonus)
```json
{
  "serviceId": "airtime",
  "network": "MTN",
  "amount": 100,
  "bonusType": "02"
}
```

### Glo 5X (500% bonus)
For Glo 5X, use specific amounts (no bonusType needed):
- N120.00 → get N600.00
- N220.00 → get N1,100.00
- N520.00 → get N2,600.00
- N1,020.00 → get N5,100.00
- N2,020.00 → get N10,100.00
- N5,020.00 → get N25,100.00
- N10,020.00 → get N50,100.00
- N15,020.00 → get N75,100.00
- N20,020.00 → get N100,100.00

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common Errors:**
- `INVALID_CREDENTIALS` - API credentials are incorrect
- `MISSING_MOBILENETWORK` - Network selection is required
- `INVALID_RECIPIENT` - Invalid phone number format
- `MINIMUM_50` - Amount is below minimum (₦50)
- `Insufficient funds` - Not enough balance in ClubKonnect account

---

## Webhook Setup

The webhook endpoint is automatically configured when making purchases. However, for production:

1. **Set Environment Variable:**
   ```env
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

2. **For Vercel:**
   - The `VERCEL_URL` environment variable is automatically used
   - No additional configuration needed

3. **For Other Hosting:**
   - Set `NEXT_PUBLIC_APP_URL` to your production domain
   - Ensure the webhook endpoint is publicly accessible

---

## Testing

### Test Purchase
```bash
curl -X POST http://localhost:3000/api/utility/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "airtime",
    "phoneNumber": "08123456789",
    "network": "MTN",
    "amount": 50,
    "userId": "your-user-id"
  }'
```

### Query Transaction
```bash
curl "http://localhost:3000/api/utility/query-transaction?orderId=789"
```

### Cancel Transaction
```bash
curl -X POST http://localhost:3000/api/utility/cancel-transaction \
  -H "Content-Type: application/json" \
  -d '{"orderId": "789"}'
```

---

## Database Integration

All transactions are stored in the `utility_transactions` table with:
- `status` - pending, completed, failed, cancelled
- `clubkonnect_reference` - Order ID from ClubKonnect
- `clubkonnect_response` - Full JSON response from ClubKonnect
- `error_message` - Error message if transaction failed

---

## Security Notes

1. **IP Whitelisting:** Your server IP must be whitelisted in ClubKonnect
2. **API Credentials:** Stored in environment variables, never in code
3. **Webhook:** Publicly accessible but only ClubKonnect can call it
4. **Validation:** All inputs are validated before API calls

---

## Support

For issues or questions:
- Check ClubKonnect documentation: https://www.clubkonnect.com/APIDocs.asp
- Review application logs for `[ClubKonnect]` messages
- Contact ClubKonnect support: 07080631845

