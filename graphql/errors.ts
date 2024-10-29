import { GraphQLError } from 'graphql/error';

export const NotLoggedInError = new GraphQLError('You have to be logged in to see this');
export const NotPermittedError = new GraphQLError('You are not permitted for this action');
