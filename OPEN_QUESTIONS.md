# OPEN_QUESTIONS

Questions to ask the company. I did **not** guess these. Current behaviour is in brackets.

## Access and roles

1. **Role matrix.** Which roles (Owner, Admin, Sales, Employee) may open the Sofa Planner?
   Which may create, edit, delete? *(Now: anyone with the placeholder permission.)*
2. **Seeing other people's layouts.** Can anyone see or edit another user's layouts?
   For example, can Sales see all layouts, or a manager see their team's?
   *(Now: owner only.)* What about Django superusers? *(Now: they pass module access.)*
3. **Default access policy** for the registry entry: on or off for new users? *(Unknown.)*
4. **Registry details:** category name, description text, icon, entry route.

## Data rules

5. **Delete.** Hard delete, or soft delete (hide but keep)? Must deleted layouts be kept for
   some time? *(Now: hard delete, with a confirm dialog.)*
6. **Change history.** Must saves and deletes be logged (who, when, old/new values)?
   *(Now: no history. Only `created_at`, `updated_at`, `version`.)*
7. **User leaves the company.** What happens to their layouts? *(Now: the user record cannot be
   hard-deleted while it owns layouts — `on_delete=PROTECT`. Deactivating is fine.)*
8. **Limits.** Max pieces per layout, max piece size, allowed units, name length.
   *(Now: safe defaults — 300 pieces, 1–2000 cm, 120 characters.)*
9. **Is a layout linked to a customer, quote or order?** *(Now: no link. No customer data stored.)*
10. **Duplicate names.** May one user have two layouts with the same name? *(Now: yes.)*

## Planner behaviour

11. **Browser drafts.** The old planner saved to the browser automatically. I kept this as an
    unsaved draft (per user + layout) so a refresh does not lose work. Rulebook §10 says drafts
    need defined rules. Is this allowed? Should drafts be cleared at sign-out (shared devices)?
12. **Catalogue data.** Piece sizes (arms, seats, recliners…) are hard-coded in JavaScript.
    Recliner sizes are marked "assumed" in the original. Should the catalogue live on the
    server, and who may change it? (Rulebook §13.)
13. **Sofa model names.** The name list is hard-coded and editable in the browser only.
    Should it come from a shared product list?
14. **Print / order form.** The "Custom order form" print mode says "Levida general order form".
    Is it an official form? Does it need the shared print behaviour (rulebook §16)?
15. **Mobile.** Must the planner editor work on phones (320 px)? The original was built for desktop.

## Platform

16. **CSP.** What is the exact Portal Content-Security-Policy?
17. **Base template.** Name of the shared base template and its slot/block names.
18. **Session checks.** Is there a shared JS helper for "session expired / user changed"
    that module pages must use?
19. **Can a module ship its own CSS file?** (Planner canvas cannot be built from daisyUI alone.)
