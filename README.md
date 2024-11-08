# uTalk CSV Import

Uma aplicação web construída com Next.js para importação em massa de contatos para o sistema uTalk através de arquivos CSV.

## 🚀 Funcionalidades

- Upload de arquivos CSV
- Mapeamento inteligente de colunas
- Validação de contatos existentes
- Atualização em lote de campos personalizados
- Interface de usuário intuitiva com feedback em tempo real
- Suporte a campos personalizados da organização
- Paginação e filtros na visualização de contatos
- Relatório detalhado de importação

## 🛠️ Tecnologias Utilizadas

- Next.js 14
- TypeScript
- Tailwind CSS
- React Dropzone
- Papa Parse (para processamento CSV)
- Radix UI (componentes base)
- Lucide React (ícones)

## 📋 Pré-requisitos

- Node.js 18+
- NPM ou Yarn
- Credenciais da API uTalk (token e ID da organização)

## 🔧 Configuração

1. Clone o repositório

    git clone [url-do-repositorio]

2. Instale as dependências
    npm install
    ou
    yarn install

3. Configure as variáveis de ambiente criando um arquivo `.env.local`:

NEXT_PUBLIC_API_BASE_URL=https://app-utalk.umbler.com/api
NEXT_PUBLIC_UTALK_API_TOKEN=seu-token-aqui
NEXT_PUBLIC_UTALK_ORGANIZATION_ID=seu-id-org-aqui

## 🚀 Executando o Projeto

npm run dev
ou
yarn dev

## 📦 Estrutura do Projeto

- `/app` - Rotas e layouts da aplicação
- `/components` - Componentes React reutilizáveis
- `/lib` - Utilitários e funções de API
- `/public` - Arquivos estáticos

## 🔒 Segurança

O projeto implementa:
- Rate limiting
- Headers de segurança
- Validação de entrada
- Sanitização de dados
- Proxy reverso para chamadas API

## 📄 Formato do CSV

O arquivo CSV deve conter no mínimo as seguintes colunas:
- Nome
- Telefone

Colunas adicionais serão mapeadas para campos personalizados da organização.

## ⚙️ Processo de Importação

1. **Upload**: Faça upload do arquivo CSV
2. **Mapeamento**: Associe as colunas do CSV aos campos do sistema
3. **Validação**: Verifique contatos existentes e novos
4. **Processamento**: Importação e atualização dos contatos
5. **Resultados**: Visualize o relatório de importação

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👥 Autores

- Alisson Ryan - Desenvolvimento inicial

## 📞 Suporte

Para suporte, envie um email para [alisson@growthad.com.br](mailto:alisson@growthad.com.br)

A aplicação estará disponível em `http://localhost:3000`

