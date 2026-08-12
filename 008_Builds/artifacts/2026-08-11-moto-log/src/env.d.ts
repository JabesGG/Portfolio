/** Parcel substitutes `process.env.NODE_ENV` at build time. This declares just
 *  enough of it for the typechecker without pulling in all of @types/node. */
declare const process: { env: { NODE_ENV?: string } };
