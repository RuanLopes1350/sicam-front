# Passo a Passo de Uso do SICAM — Manual do Usuário

Bem-vindo ao **SICAM** (*Sistema de Carta-Imagem e Análise Multitemporal*).  
Este guia explica, em linguagem simples e passo a passo, como a plataforma funciona na prática e como realizar cada tarefa do início ao fim.

---

## 1. O que é o SICAM e como ele funciona?

O SICAM ajuda equipes técnicas a **comparar imagens de satélite de duas datas diferentes** ("Antes" e "Depois") sobre uma área delimitada no mapa, identificar automaticamente áreas onde houve **desmatamento**, **degradação** ou **regeneração da vegetação**, revisar esses apontamentos visualmente e emitir um documento oficial com validade técnica: a **Carta-Imagem em PDF** acompanhada de um **Pacote Técnico (`.zip`)**.

O ciclo completo segue 5 grandes passos:

1. **Delimitar o Caso:** escolher o nome do trabalho e desenhar no mapa a área que será analisada.
2. **Escolher as Imagens:** pesquisar fotos de satélite de uma data antiga (**T0 — Antes**) e de uma data recente (**T1 — Depois**) com o mínimo possível de nuvens sobre a área.
3. **Analisar e Revisar no Mapa:** deixar o sistema calcular as mudanças automaticamente e depois conferir tudo com uma "cortina" deslizante no mapa (podendo descartar alarmes falsos, como sombra de nuvem).
4. **Emitir e Congelar o Resultado:** gerar a Carta-Imagem oficial (folha A4 ou A3) e os arquivos de mapa (`.geojson`, `.kml`, planilha `.csv`). Depois de emitido, o documento ganha um **Selo FROZEN (Congelado)** e não pode mais ser modificado.
5. **Conferir Autenticidade:** qualquer pessoa autorizada pode enviar um PDF ou `.zip` recebido na tela de verificação para ter certeza absoluta de que o arquivo é original e não foi alterado.

---

## 2. Quem faz o quê dentro do sistema?

Cada pessoa entra no sistema com um perfil definido pelo Administrador:

| Perfil | O que pode fazer na plataforma |
| :--- | :--- |
| **Analista** | Criar novos Casos, desenhar áreas no mapa, buscar imagens de satélite, iniciar análises, descartar falsos positivos, emitir Cartas-Imagem oficiais, criar novas versões e verificar autenticidade de arquivos. |
| **Auditor** | Visualizar todos os Casos, análises, cortinas comparativas e mapas (somente leitura), baixar documentos emitidos, verificar autenticidade de arquivos e consultar a **Trilha de Auditoria**. |
| **Administrador** | Cadastrar novos usuários, mudar perfis, desativar acessos imediatamente, além de consultar Casos, verificar autenticidade e acompanhar a **Trilha de Auditoria**. |

---

## 3. Passo 1 — Entrar no sistema

1. Abra o endereço do SICAM no seu navegador.
2. Na tela inicial de acesso, informe seu **E-mail** institucional e sua **Senha**.
3. Clique no botão de entrar.
4. Após o login, você verá no topo seu nome, sua **matrícula funcional**, seu perfil e a barra de menus autorizados para a sua conta.

> **Dica de segurança:** ao terminar seu trabalho em computador compartilhado, clique sempre no botão **Sair** no canto superior direito.

---

## 4. Passo 2 (Administrador) — Cadastrar e gerenciar operadores

Se você entrou com o perfil **Administrador**:

1. No menu superior, clique em **Operadores & Perfis**.
2. Para adicionar uma nova pessoa à equipe:
   - Preencha **Nome completo**, **Matrícula** (código funcional), **E-mail**, escolha o **Perfil** (*Analista*, *Auditor* ou *Administrador*) e defina uma **Senha** com pelo menos **12 caracteres**.
   - Salve o cadastro. A pessoa já poderá acessar o sistema imediatamente.
3. Para alterar o perfil de alguém ou bloquear o acesso:
   - Localize o operador na lista e abra a edição do cadastro.
   - Se marcar o usuário como **Inativo**, a sessão dele é encerrada e novos acessos são bloqueados imediatamente.

---

## 5. Passo 3 (Analista) — Criar um novo Caso e desenhar a Área de Interesse

1. No menu superior, clique em **Casos & Cartas-Imagem**.
2. Clique no botão **Novo Caso & Desenhar AOI**.
3. **Preencha as informações do Caso:**
   - **Título:** um nome claro que identifique o estudo ou localidade.
   - **Referência Externa (opcional):** número do processo administrativo, auto ou ofício vinculado.
   - **Descrição (opcional):** observações gerais sobre o pedido.
4. **Encontre o local no mapa:**
   - Use a caixa de busca de município (escolha o Estado/UF e digite o nome da cidade) para centralizar o mapa rapidamente sobre a região desejada.
5. **Defina o contorno da Área de Interesse (AOI):**
   - **Opção A — Desenhar no mapa:** clique nos cantos da área diretamente sobre o mapa para formar o polígono e clique no primeiro ponto (ou finalize o desenho) para fechá-lo. Você pode ajustar vértices ou limpar e redesenhar se errar.
   - **Opção B — Enviar arquivo pronto:** clique para importar um arquivo `.geojson` caso você já possua o polígono salvo de outro programa de mapas.
6. Confira no painel lateral os valores calculados em tempo real (área em hectares, perímetro e se o polígono está dentro do tamanho permitido e sem linhas cruzadas).
7. Clique para salvar o Caso.
   - O sistema cria automaticamente um **Código de Protocolo** oficial e calcula quais municípios ficam dentro da área desenhada.
   - **Atenção:** depois de salvo, o **desenho da área e o protocolo nunca mais podem ser alterados**. Se precisar mudar apenas o título ou a referência externa, você poderá editar esses textos na página do Caso.

---

## 6. Passo 4 (Analista) — Buscar imagens de satélite (Antes e Depois)

Dentro da página do Caso criado, clique para iniciar uma nova análise:

1. **Escolha os períodos de pesquisa:**
   - Em **Janela T0 (Antes)**, informe a data inicial e final do período mais antigo que você quer usar como base (limite de até 180 dias por busca).
   - Em **Janela T1 (Depois)**, informe a data inicial e final do período mais recente para comparação.
   - Você também pode ajustar o limite máximo de nuvens da cena e quais catálogos consultar (*AWS Earth Search* / *INPE Brazil Data Cube*).
2. Clique para **Buscar Cenas**:
   - O sistema verifica as imagens disponíveis e mede **quanta nuvem existe exatamente em cima da sua área desenhada**, ordenando primeiro as opções mais limpas.
   - **Cobertura e multi-tile:** quando a sua área pega mais de um quadrado do satélite na mesma data, a lista já junta as imagens automaticamente com uma etiqueta indicando que é um mosaico.
   - Clique para visualizar a **miniatura** de cada candidata antes de escolher e veja o percentual de nuvem real na AOI.
3. Selecione **uma cena para T0 (Antes)** e **uma cena para T1 (Depois)**:
   - Se as duas datas escolhidas estiverem em épocas do ano muito diferentes (mais de 60 dias de diferença no calendário anual, como comparar período seco com período chuvoso), aparecerá um **aviso de sazonalidade** lembrando que folhas mais secas ou verdes pela estação podem influenciar o cálculo.
4. **Escolha o modo de cálculo (Preset Espectral):**
   - **Padrão Técnico (`TECHNICAL_STANDARD`):** configuração recomendada para a maioria dos monitoramentos.
   - **Conservador (`CONSERVATIVE`):** exige sinais mais fortes e áreas maiores antes de marcar um alerta, reduzindo falsos positivos.
   - **Personalizado (`CUSTOM`):** libera ajuste fino dos parâmetros dentro de faixas técnicas seguras e registra automaticamente no relatório que foram usados parâmetros customizados.

---

## 7. Passo 5 — Iniciar a análise e acompanhar ao vivo

1. Confira o resumo com a cena T0, a cena T1 e o modo escolhido, e clique para **Disparar Análise**.
2. Você será levado automaticamente para a tela de acompanhamento da execução.
3. A barra de progresso mostra em tempo real em qual etapa o servidor está (sem precisar ficar apertando F5):
   - Na fila de processamento;
   - Lendo as bandas das imagens de satélite;
   - Calculando as diferenças de vegetação ($\Delta\text{NDVI}$) e removendo nuvens;
   - Gerando os polígonos e as imagens finais em alta qualidade;
   - Pronto para revisão técnica!

---

## 8. Passo 6 (Analista) — Revisar o mapa com a Cortina Comparativa e limpar falsos alertas

Quando o status mudar para **Pronto para Revisão**, a tela libera o mapa comparativo e a tabela de resultados:

1. **Explore a Cortina Comparativa ($T_0 \times T_1$):**
   - No centro do mapa existe uma **linha vertical com alça de arraste** (ou você pode usar a barra deslizante abaixo do mapa).
   - Arrastando para a direita você vê mais da imagem antiga (**T0 — Antes**); arrastando para a esquerda você revela a imagem recente (**T1 — Depois**), facilitando comparar exatamente o mesmo pedaço de terra nas duas datas.
2. **Alterne as visualizações acima do mapa:**
   - **Cor Natural (RGB):** mostra a paisagem como os nossos olhos veem (verde da floresta, solo exposto, rios).
   - **Falsa-Cor (NIR):** destaca a vegetação viva em tons fortes, ajudando a enxergar áreas onde a mata perdeu vigor ou foi raleada.
   - **Máscara $\Delta\text{NDVI}$ + SCL:** liga/desliga a camada colorida de áreas alteradas e permite regular a transparência para ver a foto de satélite por baixo.
   - **Polígonos Vetorizados:** exibe os contornos numerados (`P1`, `P2`, `P3`...) em ordem da maior área para a menor.
   - **Mapa de fundo e Enquadrar AOI:** permite alternar entre mapa de ruas, satélite ou fundo escuro técnico, e centralizar o zoom de volta na área do caso com um clique.
3. **Descartar falsos positivos (Curadoria):**
   - Clicando em um polígono no mapa ou na tabela abaixo dele, você confere sua área em hectares, classe (*Desmatamento*, *Degradação* ou *Regeneração*) e coordenadas.
   - Se perceber que um polígono detectado foi causado por sombra de nuvem, névoa ou ruído da imagem, clique para **Descartar como falso positivo**.
   - Digite uma **justificativa técnica clara** (mínimo de 15 caracteres) explicando o motivo e confirme.
   - O sistema recalcula os totais de hectares da análise na hora, desconsiderando o polígono descartado (mas mantendo o registro completo da sua justificativa para auditoria). Caso mude de ideia antes de congelar o documento, é possível restaurar o polígono.

---

## 9. Passo 7 (Analista) — Emitir a Carta-Imagem, baixar arquivos e criar novas versões

Quando a revisão estiver concluída:

1. Clique no botão para **Emitir Carta-Imagem & Congelar Versão**.
2. Na janela que abrir:
   - Escolha o tamanho do papel: **A3** (folha grande, ideal para mapas detalhados) ou **A4**.
   - Se desejar, escreva **Observações técnicas** para aparecerem na legenda do documento oficial e no manifesto.
   - Clique para confirmar a emissão.
3. Acompanhe o progresso na tela enquanto o sistema gera a prancha cartográfica em alta resolução (300 DPI) e empacota todos os arquivos.
4. **O Selo `FROZEN` (Congelado):**
   - Ao finalizar, a versão recebe o selo **`FROZEN`**. A partir desse instante, ninguém mais pode alterar os polígonos ou descartes desta versão, garantindo que o documento impresso e os dados digitais permaneçam idênticos ao que foi aprovado.
5. **Fazer downloads:**
   - Clique em **Baixar Carta-Imagem (.pdf)** para obter o mapa pronto para anexar em processos ou imprimir;
   - Clique em **Baixar Pacote Técnico (.zip)** para obter o kit completo contendo o PDF, planilha `.csv` dos polígonos, arquivos vetoriais `.geojson` e `.kml` (para abrir em Google Earth ou QGIS), as imagens PNG de evidência e o arquivo `05_manifesto_auditoria.json` com todos os códigos de verificação **SHA-256**.
6. **Precisa refazer com outras datas ou ajustes?**
   - Use a barra de versões no topo da análise (`v1`, `v2`...) e clique em **+ Nova Versão**. A versão congelada anterior continua preservada intacta no histórico para comparação, enquanto você cria a `v2`.

---

## 10. Passo 8 (Todos os perfis) — Verificar a autenticidade de um documento recebido

Se alguém encaminhar a você uma **Carta-Imagem em `.pdf`** ou um **Pacote Técnico `.zip`** e você quiser confirmar se ele é verdadeiro e não foi editado por terceiros:

1. No menu superior, clique em **Verificar Integridade**.
2. Escolha uma das duas formas de conferir:
   - **Enviar o arquivo (recomendado):** arraste ou selecione o arquivo `.pdf` ou `.zip` (até 100 MB). O sistema calcula a "impressão digital" matemática (**SHA-256**) do arquivo e compara com o banco oficial.
   - **Colar o código SHA-256:** se você recebeu apenas o código de 64 letras e números que vem impresso na Carta-Imagem ou no manifesto, cole o código no campo indicado.
3. Clique em verificar:
   - **Autêntico / Verificado:** exibe o código do protocolo, título do caso, município, versão, escala cartográfica, áreas medidas, data exata da emissão e nome/matrícula de quem emitiu.
   - **Não encontrado / Divergente:** significa que o arquivo não foi emitido por esta base oficial do SICAM ou teve algum byte modificado após a emissão.

---

## 11. Passo 9 (Auditor e Administrador) — Consultar a Trilha de Auditoria

Para fiscalizar quem fez o quê e quando no sistema:

1. No menu superior, clique em **Trilha de Auditoria**.
2. Use os filtros disponíveis (tipo de ação, entidade, identificador de correlação ou intervalo de datas) para localizar eventos específicos, como logins, criação de casos, descartes de polígonos, emissões congeladas ou downloads de pacotes.
3. Navegue pelos registros em ordem cronológica reversa. Cada linha mostra data/hora, operador responsável, matrícula, endereço IP e os detalhes técnicos da operação — nenhum registro de auditoria pode ser editado ou apagado.
