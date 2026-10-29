"use client";
import { useState } from "react";
import { Brand, Button, Badge, ArrowUpRight } from "@devflow/product";
export default function Demo() {
  const [cart, setCart] = useState<string[]>([]),
    [error, setError] = useState("");
  function checkout() {
    try {
      const item = cart[0];
      if (item === undefined)
        throw new TypeError(
          "Cannot read properties of undefined (reading 'price')",
        );
      setError("Demo checkout complete. No payment was taken.");
    } catch (e) {
      setError(
        `${e instanceof Error ? `${e.name}: ${e.message}` : "Checkout failed"}\n  at Checkout.calculateTotal (demo/checkout.tsx:42)\nCart items: 0 · action: checkout`,
      );
    }
  }
  return (
    <main className="demo-app stack">
      <a href="/">
        <Brand />
      </a>
      <Badge tone="amber">
        Safe demo app · no payments or external requests
      </Badge>
      <h1>DevFlow Supply</h1>
      <p className="muted">
        A deliberately broken React checkout. Leave the cart empty, press
        Checkout, then select the displayed error and click the DevFlow toolbar
        icon.
      </p>
      <div className="demo-products">
        {["Mechanical keyboard", "Developer notebook", "Desk mat"].map(
          (name) => (
            <article className="demo-product" key={name}>
              <h3>{name}</h3>
              <p className="muted">Demo item</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setCart([...cart, name]);
                  setError("");
                }}
              >
                Add to cart
              </Button>
            </article>
          ),
        )}
      </div>
      <div className="actions">
        <Badge>{cart.length} items in cart</Badge>
        <Button onClick={checkout}>Checkout</Button>
        <Button
          variant="secondary"
          onClick={() => {
            setCart([]);
            setError("");
          }}
        >
          Reset demo
        </Button>
        <a href="/dashboard/new" className="inline-link">
          Open manual capture <ArrowUpRight size={13} />
        </a>
      </div>
      {error && (
        <pre className="demo-error" data-testid="demo-error">
          {error}
        </pre>
      )}
      <p className="muted text-sm">
        Expected behavior: show “Your cart is empty” and keep the page usable.
        Actual behavior: the empty cart reaches the total calculator and throws.
        These facts can be entered as developer notes.
      </p>
    </main>
  );
}
