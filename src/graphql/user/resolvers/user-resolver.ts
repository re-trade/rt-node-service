let messages = [
    { id: "1", content: "Hello, World!", createdAt: new Date().toISOString() },
];

const resolvers = {
    Query: {
      messages: () => messages,
    },
  
    Mutation: {
      addMessage: (_: any, { content }: { content: string }) => {
        const newMessage = {
          id: String(messages.length + 1),
          content,
          createdAt: new Date().toISOString(),
        };
        messages.push(newMessage);
        return newMessage;
      },
    },
};

export default resolvers;