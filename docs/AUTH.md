# Authentication Methods

Cocktail Manager currently supports the following authentication backends:

## Google OAuth

#### Retrieving Client ID and Secret

To generate the Google OAuth credentials, go to
the [Google Developer Console](https://console.developers.google.com/apis/credentials) and create a OAuth 2.0-Client
with the following settings:

- Redirect URIs: http://localhost:3000/api/auth/callback/google

#### Configuring the .env file

Set the following environment variables in the `.env` file:

| Variable             | Description               |
|----------------------|---------------------------|
| GOOGLE_CLIENT_ID     | Your Google Client ID     |
| GOOGLE_CLIENT_SECRET | Your Google Client Secret |

## Custom OpenID Connect

The custom OpenID Connect authentication method can be used with any compliant OIDC provider.

#### Configuring the OIDC provider

When configuring the client in the OIDC provider, use the following settings:

- Redirect URIs: http://localhost:3000/api/auth/callback/custom_oidc

#### Configuring the .env file

Set the following environment variables in the `.env` file:

| Variable                  | Description                                                   |
|---------------------------|---------------------------------------------------------------|
| CUSTOM_OIDC_NAME          | The name shown on the Login page                              |
| CUSTOM_OIDC_ISSUER_URL    | The OIDC provider's issuer URL for discovery                  |
| CUSTOM_OIDC_CLIENT_ID     | Your OIDC client ID                                           |
| CUSTOM_OIDC_CLIENT_SECRET | Your OIDC client secret (might be optional)                   |
| CUSTOM_OIDC_SCOPES        | The requested scopes (default: `openid email profile`)        |
| CUSTOM_OIDC_ID_KEY        | The userinfo key that hold the users id (default: `sub`)      |
| CUSTOM_OIDC_NAME_KEY      | The userinfo key that hold the users name (default: `name`)   |
| CUSTOM_OIDC_EMAIL_KEY     | The userinfo key that hold the users email (default: `email`) |
