import { orderPizzaFlow } from "../scenarios/orderPizza.js";

export const options = {
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  stages: [
    { target: 100, duration: "1m" },
    { target: 100, duration: "3m" },
    { target: 0, duration: "1m" },
  ],

  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    "checks{kind:functional}": ["rate>0.99"],
  },
};

export default function () {
  orderPizzaFlow();
}