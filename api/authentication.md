---
title: Authentication
sidebar_position: 3
---

The Market Data API uses a token for authentication. The token is required for each request and it can be added to the request's authorization header or supplied or as a parameter in the URL.

:::tip
We recommend using header-based authentication to ensure your token is not stored or cached. While Market Data makes a conscientious effort to delete tokens from our own server logs, we cannot guarantee that your token will not be stored by any of our third party cloud infrastructure partners.
:::

## Header Authentication

Add the token to the ```Authorization``` header using the word ```Token```. 

### Code Examples

<Tabs>
<TabItem value="HTTP" label="HTTP" default>

```http
GET /v1/stocks/quotes/SPY/ HTTP/1.1
Host: api.marketdata.app
Accept: application/json
Authorization: Token {token}
```

</TabItem>
<TabItem value="Node.js" label="Node.js">

```javascript
const https = require('https');

// Your API token
const apiToken = 'your_api_token_here';

// The API endpoint for retrieving stock quotes for SPY
const url = 'https://api.marketdata.app/v1/stocks/quotes/SPY/';

// Making the GET request to the API
https.get(url, {
    headers: {
        'Accept': 'application/json',
        'Authorization': `Token ${apiToken}`
    }
}, (response) => {
    let data = '';

    // A chunk of data has been received.
    response.on('data', (chunk) => {
        data += chunk;
    });

    // The whole response has been received. Print out the result.
    response.on('end', () => {
        if (response.statusCode === 200 || response.statusCode === 203) {
            console.log(JSON.parse(data));
        } else {
            console.log(`Failed to retrieve data: ${response.statusCode}`);
        }
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
```

</TabItem>
<TabItem value="Python" label="Python">

```python
import requests

# Your API token
api_token = 'your_api_token_here'

# The API endpoint for retrieving stock quotes for SPY
url = 'https://api.marketdata.app/v1/stocks/quotes/SPY/'

# Setting up the headers for authentication
headers = {
    'Accept': 'application/json',
    'Authorization': f'Token {api_token}'
}

# Making the GET request to the API
response = requests.get(url, headers=headers)

# Checking if the request was successful
if response. status_code in (200, 203):
    # Parsing the JSON response
    data = response.json()
    print(data)
else:
    print(f'Failed to retrieve data: {response.status_code}')
```

</TabItem>


<TabItem value="Go" label="Go">

```go
// Import the Market Data SDK
import api "github.com/MarketDataApp/sdk-go"

func main() {
    // Create a new Market Data client instance
    marketDataClient := api.New()

    // Set the token for authentication
    // Replace "your_token_here" with your actual token
    marketDataClient.Token("your_token_here")

    // Now the client is ready to make authenticated requests to the Market Data API
    
    // Use the client to create a StockQuoteRequest
	sqr, err := api.StockQuote(marketDataClient).Symbol("SPY").Get()
    if err != nil {
		fmt.Println("Error fetching stock quotes:", err)
		return
	}

	// Process the retrieved quote
	for _, quote := range quotes {
		fmt.Printf(quote)
	}
}
```

</TabItem>
</Tabs>


## URL Parameter Authentication

Add the token as a variable directly in the URL using the format ```token={token}```. For example:

```
https://api.marketdata.app/v1/stocks/quotes/SPY/?token={token}
```

:::caution
If you associate a brokerage connection with a token, URL Parameter Authentication will be disabled for that token. Only Header Authentication will be allowed.
:::

### Demo The API With No Authentication

You can try stock, option, and index endpoints with several different symbols that are unlocked and do not require a token. 

- Try any stock endpoint with **AAPL**, no token required.
- Try any option endpoint with any AAPL contract, for example: **AAPL250117C00150000**. No token required.
- Try any index endpoint using **VIX**, no token required.
