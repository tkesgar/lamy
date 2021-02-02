import knex, { Transaction } from "knex";

export type Connection = knex | Transaction;

export interface ConnectionOpts {
  conn: Connection;
}

export * from "./row";
