import { orderPizzaFlow } from "../scenarios/orderPizza.js";

export const options = {
  vus: 1,
  iterations: 1,

  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  orderPizzaFlow();
}