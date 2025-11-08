/*


OpenAPI Specification
    /reset:
        delete:
        responses:
            "200":
            description: Registry is reset.
            "401":
            description: You do not have permission to reset the registry.
            "403":
            description: Authentication failed due to invalid or missing AuthenticationToken.
        operationId: RegistryReset
        summary: Reset the registry. (BASELINE)
        description: Reset the registry to a system default state.
        parameters:
        - name: X-Authorization
            description: ""
            schema:
            $ref: "#/components/schemas/AuthenticationToken"
            in: header
            required: true

*/