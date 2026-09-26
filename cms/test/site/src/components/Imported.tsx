// a server component that a page loads with a dynamic import() as it renders
export async function Imported(props: { name: string }) {
  return <p>Imported for {props.name}</p>
}
