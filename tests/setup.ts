import { beforeAll, afterAll } from "bun:test"

beforeAll(() => {
  // Global test setup — e.g. set test env vars, init mocks
  process.env.NODE_ENV = "test"
})

afterAll(() => {
  // Global teardown
})
