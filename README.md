# Nexus Dev Lab ✳

Uma demonstração interativa, responsiva e sem dependências de framework. A página inicial foi transformada em um pequeno gerenciador de projetos com dados reais do próprio navegador.

## O que funciona

- **Projetos dinâmicos:** criar, visualizar, editar e excluir projetos;
- **Busca, filtros e ordenação:** por texto, etapa, favoritos, nome e data;
- **Favoritos:** marcar ou desmarcar projetos;
- **Painel atualizado:** total de projetos, etapas e percentual concluído;
- **Notas rápidas:** salvas automaticamente;
- **Console interativo:** comandos de ajuda, projetos, status, favoritos, tema, busca, criação e exportação;
- **Preferências:** tema claro/escuro preservado no navegador;
- **Backup:** exportar e importar projetos e notas como JSON;
- **Responsividade:** adaptação para computadores, tablets e celulares.

## Como rodar

Sem instalação:

1. Baixe ou clone o repositório.
2. Abra `index.html` em um navegador moderno.

Opcionalmente, execute um servidor estático local:

```bash
clear
git clone https://github.com/Kingnike1/nexus-lab-demo.git
cd nexus-lab-demo
python3 -m http.server 8000
```

Depois abra http://localhost:8000.

## Estrutura do projeto

| Arquivo | Finalidade |
| --- | --- |
| `index.html` | Estrutura semântica da interface |
| `styles.css` | Layout, estilos e tema responsivo |
| `data.js` | Projetos de exemplo exibidos na primeira visita |
| `app.js` | Interações, gerenciamento de dados e armazenamento |

## Onde ficam os dados?

**No próprio navegador**, usando `localStorage`. Isso significa:

- Os projetos criados por você aparecem somente naquele navegador e perfil.
- Outras pessoas que abrirem o endereço começam com os exemplos originais.
- Limpar os dados do navegador pode apagar suas alterações.
- O botão **Gerenciar dados → Baixar backup JSON** permite salvar um arquivo para restaurar depois.
- Alterações feitas na interface não modificam o repositório do GitHub.

Para ter projetos sincronizados entre dispositivos, contas de usuário e colaboração, será necessário adicionar uma **API, banco de dados e autenticação**. A demonstração atual não expõe um backend público de escrita.

## Publicar na Vercel

1. Acesse https://vercel.com/new.
2. Importe o repositório `Kingnike1/nexus-lab-demo`.
3. Escolha **Framework Preset: Other**.
4. Mantenha o diretório raiz `./`, sem comando de build, e clique em **Deploy**.

Ao conectar a branch `main`, a Vercel pode publicar automaticamente os commits seguintes.

## Sobre os exemplos

Nexus Share, Digital Vault e Meu Financeiro são **conceitos apresentados nesta demonstração**. Não representam aplicativos externos funcionando dentro deste repositório.

---

Nexus Dev Lab · 2026
