export const findReactProp = (element: any, propPrefix: string): any => {
  // Get all property names on the element
  const props = Object.keys(element);

  // Find the property that matches the React Fiber naming pattern
  const reactProp = props.find(prop => prop.startsWith(propPrefix));

  // Return the value of the matching property, or null if not found
  //? element[reactProp] : null;
  return reactProp;
};
