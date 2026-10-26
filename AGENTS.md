<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Public backend configuration lives in `src/lib/backend-config.ts` and is bound to both browser and server by Vite defines, so managed Cloud environment values cannot route app sessions to a different project; never put private credentials in that module.
- Account sign-in is required for the external backend; preserve email confirmation and do not create anonymous users or use the managed Cloud OAuth broker for external accounts.
