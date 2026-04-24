> Archive — early thesis / brainstorm. Not canonical. For current strategy see [CULTURE-BRAND-VISION.md](CULTURE-BRAND-VISION.md); for voice and vocabulary see [CULTURE-BRAND-GUIDE.md](CULTURE-BRAND-GUIDE.md). Known contradictions (including 1T vs 1B token supply) are tracked in [BRAND-RECONCILIATION.md](BRAND-RECONCILIATION.md).

CULTURE

Lifestyle brand

CHANNELS
- Web / mobile
	URL ideas: forthecult.store
- AI
- X
- TikTok
- Discord, Telegram

REVENUE MODEL
1) Receive 65% TX fees from CULT trading volume
2) Margin on goods - 5% - 200%
3) Crypto<->crypto tx fees (SideShift.ai)
4) Referral fees

PRODUCTS
High quality products that we want ourselves. Products that improve health, autonomy, and culture.

Product ideas:

*Food*
- Coffee
- Needs research / sourcing (high quality):
	- Dark chocolate
	
*Swag*
- Shoes
- Limited t-shirts
- Limited hoodies
- Alpaca socks

*Merchandize*
- Phone cases
- Berkey water filter (decentralized water)
- NFT Picture frames
- PacSafe bags for travelers
- Wallets
- 3D printed items

*Technology*
- eSIM cards
- VPN subscriptions
- Oculus VR
- AR (need brand)
- Red light therapy lights
- Solana phones
- Nodes (Helium nodes)
- Trezor HW Wallets
- Laptops
- Smart home devices

*Other*
- NFTs
- Gift cards

*AI*
- Products / services AI can use?

ARTIFICIAL INTELLIGENCE
Native AI integration

Alice
	- AI Agent and chatbot
	- Order products directly through Alice
	- Develop MCP and API for seamless integration into any AI agent
	- CULT token holders can ask Alice to create a new product
	- Integrated into telegram, Discord, and X
	
PAYMENT Methods

Bitcoin (BTCPay Server)
Bitcoin Lightning Network
Dogecoin
Monero
Stablecoins (EVM, tron, sol networks)
Ethereum
EVMs (Base, Arbitrum, Polygon, BNB)
Solana (Solana Pay)
SPL tokens
CULT token
SUI
TON
Credit / debit card


	
TECHNOLOGY
Native Web3 integration and privacy features

	- Sign up optional
	- Sign up / login with wallet, email, telegram, Discord, X
	- Instant refund (stablecoin) if item not shipped yet
	- Customer data can be downloaded, stored locally (browser), and/or removed from central database (after item has shipped) (long-term goal)

*Frontend*
- React
- Host: Railway
- Better Auth
- Libraries
	- WEB3:
		- Wagmi
		- Solana Kit
		- TON web3 (needs research)
	- Address finder
	- Chat? - needs research
- HTTPS: Let's Encrypt

*Admin frontend*
- React
- HTTPS: Let's Encrypt

*Backend*
- Drizzle PostgresSQL
- Host: Supabase
- Uploadthing

*AI*
- LLM: Venice
- Openclaw
- Host: Railway, might need changing

*EMAIL*
- Resend

*DNS*
Host: Needs research
- ENS & SNS

CUSTOMER PROFILE

Agentic AI
- Gifts for human
- eSIMs, data, products for self

Human customer:
Age: 18 - 50

city dwellers, technology enthusiasts, CT,  men (mostly), women,

MARKETING
Initially:
- X
	- Advertising
	- CULT Community
	- KOLs
	
- Partnerships
	- Crypto projects
	- Influencers
	Examples:
		- Pump Fun
		- Psyop Anime
		- Troll
- Discord - Gated with CULT
- Telegram - Also has gated channel
- Newsletter
- TikTok

AFFILIATES
Decentralized services only

- crypto<->crypto: SideShift, 
- DEX: HyperLiquid, 1INCH, UNI, 
- Lending: AAVE
- Crypto debit card?


TOKEN MECHANICS
- 1 trillion max supply
- token burn

*Staking*
- Receive 5% creator fees
- View sales data
- Product input

*Gating*
- Products only available when have X number of CULT in wallet
- Limited number of product, becomes unavailable unless have CULT in wallet

Creator Fees
- Burn CULT tokens (5%)
- Locked-CULT holders (5%)
- Purchase inventory and artwork (10%)
- Charity - research (10%)
- Lottery giveaway? (5%)
- Subsidize product prices
- Build out AI integration

LONG TERM INTEGRATIONS

- NFTs
- Phygital
- Custom merchandize

DB Schema (WIP)
Customer
user:
- id
- alias (string)
- firstName (string)
- lastName (string)
- email (optional, research) - regex (string)
- phone (optional?)
- password
- dateOfBirth
- STREET ADDRESS (string)
- UNIT NUMBER
- POST CODE (string)
- STATE / PROVINCE (string)
- COUNTRY (string)
- verified
- coverPicture
- profilePicture
- socialLinks
- REMEMBER CUSTOMER (for future orders)
- USER ID (string)
- ORDER ID (string)
- IP ADDRESS?

Product
- id
- slug
- title
- imgURL
- description
- buttonLink
- price
- size
- colors
- discount
- Vendor
- thumbnail
- images
- image
- Photo
- Vendor
- brand
- Quantity
- Page title
- Meta description
- Variants
- categories
- type
- status
- reviews
- SKU
- URL
	



EMAIL
- WELCOME
- ORDER
- SHIPMENT UPDATE




For the Cult
CULT

Features:
- Spend it on cool shit
- Get cool shit early
- Regular token burns
- Gating on Discord / Telegram
- Access to store sales
- Free shipping
- Product discounts
- Vote on new products


The Culture token ticker is CULT

Privacy first:
- No Shopify
- No trackers
- No required account creation
- Data is only shared with shipping company
- Optional emails



First, let's break market into three broad segments:


-   Crypto OGs
-   Crypto bros (probably your biggest market, currently)
-   Normies (no coiners)

Target the normie market through an encompassing narrative that brings them closer to crypto OGs, without making the narrative about crypto. Crypto becomes the means, rather than the end.

The narrative weaves wellness with personal and financial freedom. This can be done by utilizing the cross-sections of decentralisation, open-source, privacy, longevity, health.


The most important aspect is consistency in the curation of the products, they must stick to the core values mentioned above, without compromise.

For example, starting with the crypto side:


-   Add Lightning Network payments (through BTCPay) (targets Crypto OGs)
-   Add prices in crypto, of user's choice (e.g. drop-down for BTC, ETH, DOGE)
    
-   Add PGP option for communication (crypto OGs, a nice touch, long term)
-   Add crypto and depin hardware:

-   Bitcoin nodes (Crypto OGs)
-   Retail bitcoin miners (normies)
-   depin nodes e.g. Helium node (normies, earn income (crypto) running depin)

-   Partner with crypto recovery service as a referral service, get a 20% referral commission of the total commission of recovered coins (all markets)
-   Add crypto swap widget on website for instant crypto<->crypto conversion, get referral fee (crypto markets)
    
-   Add carefully curated decentralized crypto services for the referral revenue
-   High quality phones with GrapheneOS, open source
-   Referrals to privacy enhancing tools (e.g. https://joindeleteme.com/)



Product additions:

-   NFT picture frames (normies, eventually)
-   Smart home devices - curation is extremely important here, stick to high quality, open source, private, rather than Google Home/Amazon Echo (normies, long-term)
-   eSIMs (lifestyle, all markets)
-   VPN subscriptions (this is where curation is important)
-   VR/AR headsets, and related tech (normies, long-term)
-   Drones / security drones (normies, long-term)
-   Books (carefully curated selection, normies)



The health and wellness products are where everything comes together as a lifestyle brand:

-   Toxin-free apparel:

-   Clothing that is made with natural fibers (cotton, bamboo, alpaca)
-   Remove polyester and other material that decreases longevity (increases risks of cancer, autoimmune diseases)
-   Go phygital. Clothes are tokenized, and in some cases offer limited runs and scarcity

-   High quality shoes and apparel (https://www.earthrunners.com/)
-   Travel bags, with security and durability in mind
-   Atmospheric water generator
-   Red lights (red light therapy)
-   Foodstuff related to health and wellness (well sourced, quality coffee)


Long-term (ideas)

-   Digital nomad services, e.g. second passports
-   Laptops (opensource, high quality)
-   3D printed products and/or 3D printers (e.g. 3D printed shoes)
-   High-tech products that feel futuristic now, but will be incorporated into everyday life (wireless HDMI, at-home health and lab test kits)
-   Humanoid robots
-   Air taxis, teslas


The beauty, is that with a consistent brand identity and narrative, you can utilize the brand to roll out lots of new products that target a much broader market, but sticks to your core values.