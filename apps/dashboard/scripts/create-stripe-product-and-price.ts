import Stripe from "stripe"

const stripe = new Stripe(process.env["STRIPE_API_KEY"] ?? "")

async function main() {
  const product = await stripe.products
    .create({
      name: "Block Feed",
    })
    .then((data) => {
      console.log("Product:")
      console.log(JSON.stringify(data, null, 2))
      return data
    })

  await stripe.prices
    .create({
      nickname: "Block Feed Pricing",
      product: product.id,
      currency: "usd",
      recurring: {
        interval: "month",
        aggregate_usage: "sum",
        usage_type: "metered",
      },
      billing_scheme: "per_unit",
      unit_amount: 1, // 1 cent per request
    })
    .then((data) => {
      console.log("\nPricing:")
      console.log(JSON.stringify(data, null, 2))
      return data
    })
}

main()
