"""Test-project-only middleware. Not part of the sofa_planner module."""


class StrictCSPMiddleware:
    """Send a strict Content-Security-Policy header.

    No 'unsafe-inline' and no outside hosts. If the planner still had inline
    scripts or style="" attributes, the browser would block them here.
    TODO-PORTAL: the real Portal CSP may differ. Ask for the exact policy.
    """

    POLICY = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "object-src 'none'"
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("Content-Security-Policy", self.POLICY)
        return response
